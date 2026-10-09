'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import { useSound } from 'components/Sound/sound';
import { statsOverlay } from 'components/StatsOverlay/statsStore';
import { rangeBetween, stationForPath, stationNames } from 'components/World/routes';
import { launchWorldMode, navigateFromMode } from 'components/World/worldMode';
import {
  emitCue,
  onFlight,
  requestLaunch,
  setPreview,
  worldStore,
} from 'components/World/worldStore';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useMotionPref } from '@/hooks/useMotion';
import { useWorldPreference } from '@/hooks/useWorldPreference';
import { setMotionPref } from '@/utils/motion';

import type { StationKey } from 'components/World/routes';
import type { MotionPref } from '@/utils/motion';

import './CommandPalette.scss';

export interface PaletteData {
  pages: { href: string; label: string }[];
  projects: { title: string; slug: string }[];
  email: string;
  cv: { url: string; name: string };
  links: { name: string; url: string }[];
  whoami: string;
}

type Group = 'Navigate' | 'World' | 'Actions' | 'Projects' | 'Links' | 'Terminal';

interface Command {
  id: string;
  group: Group;
  label: string;
  icon: string;
  hint?: string;
  keywords?: string;
  /** The station a page or project lives at: selecting the row previews the course there */
  station?: StationKey;
  /** The page you're on (it reads "Docked", and isn't where the selection starts) */
  current?: boolean;
  /** Return true to keep the palette open */
  run: () => boolean | void;
}

interface Line {
  id: number;
  text: string;
  tone?: 'input' | 'ok' | 'warn' | 'dim';
}

/* ------------------------------------------------------------------
   Opening from elsewhere (the header button)
   ------------------------------------------------------------------ */
const openListeners = new Set<() => void>();
export const commandPalette = {
  open: () => openListeners.forEach((listener) => listener()),
};

let lineCounter = 0;
const nextLineId = () => ++lineCounter;

const groupOrder: Group[] = ['Terminal', 'Navigate', 'World', 'Actions', 'Projects', 'Links'];
const terminalWords = [
  'help',
  'whoami',
  'ls',
  'cd',
  'sudo',
  'clear',
  'exit',
  'echo',
  'date',
  'ping',
  'rm',
  'tour',
  'explore',
  'stats',
  'theme',
];

/**
 * `sudo hire lewis` while it types itself out, before it navigates: its
 * timers, cleared if the palette closes first (there is one palette)
 */
const hire = { timers: [] as number[] };

/** Stops `sudo hire lewis` if it hasn't navigated yet; true if it was running */
function cancelHire() {
  if (!hire.timers.length) return false;
  hire.timers.forEach((id) => window.clearTimeout(id));
  hire.timers = [];
  return true;
}

/** The motion levels (utils/motion.ts) as palette commands */
const motionChoices: { pref: MotionPref; label: string; icon: string }[] = [
  { pref: 'system', label: 'Motion: follow system', icon: 'ph:gear-six-bold' },
  { pref: 'full', label: 'Motion: full', icon: 'ph:wind-bold' },
  { pref: 'calm', label: 'Motion: calm', icon: 'ph:feather-bold' },
  { pref: 'still', label: 'Motion: still', icon: 'ph:pause-bold' },
];

/** How long a row must stay selected before the world previews the course to it (as link hovers do) */
const previewDelay = 140;

/** The first row to start on: the first that isn't the page you're on */
const firstActive = (rows: Command[]) =>
  Math.max(
    0,
    rows.findIndex((row) => !row.current)
  );

/**
 * After a palette navigation, focus the new page's heading once it shows
 * (the route has changed, the page is back in page mode and not inert,
 * and any flight is on its final approach), so a keyboard or screen
 * reader user lands at the top of what they asked for. Gives up after 8s,
 * or if focus has moved on meanwhile
 */
function focusHeadingOnArrival(path: string) {
  const started = performance.now();
  let from: Element | null | undefined;
  const step = () => {
    if (performance.now() - started > 8000) return;
    // Where focus went as the palette closed (its opener, or the body)
    from ??= document.activeElement;
    if (document.activeElement !== from && document.activeElement !== document.body) return;
    const main = document.getElementById('main-content');
    const heading = main?.querySelector<HTMLElement>('h1');
    const { flight } = worldStore;
    const mode = document.documentElement.dataset.worldMode ?? 'page';
    const shown =
      window.location.pathname === path &&
      main &&
      heading &&
      !main.inert &&
      mode === 'page' &&
      (!flight.active || flight.approached) &&
      heading.getClientRects().length > 0;
    if (!shown) {
      requestAnimationFrame(step);
      return;
    }
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  };
  requestAnimationFrame(step);
}

/** Case-insensitive match: substring beats in-order letters; 0 means no match */
function score(text: string, query: string) {
  const haystack = text.toLowerCase();
  if (!query) return 1;
  if (haystack.startsWith(query)) return 4;
  if (haystack.includes(` ${query}`)) return 3;
  if (haystack.includes(query)) return 2;
  let i = 0;
  for (const char of haystack) if (char === query[i]) i++;
  return i === query.length ? 1 : 0;
}

/**
 * ⌘K / Ctrl+K: jump to any page or project, drive the 3D world and run a
 * few toy terminal commands (try `help`). A combobox over a listbox: arrow
 * keys move, Enter runs, Escape closes.
 */
export function CommandPalette({ data }: { data: PaletteData }) {
  const pathname = usePathname();
  const here = stationForPath(pathname);
  const lenis = useLenis();
  const { toggleTheme } = useTheme();
  const { enabled, supported, setEnabled } = useWorldPreference();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /** The selected row; -1 until arrows or the pointer pick one (then the first that isn't this page) */
  const [active, setActive] = useState(-1);
  const [lines, setLines] = useState<Line[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const baseId = useId();

  const print = useCallback((text: string, tone?: Line['tone']) => {
    const id = nextLineId();
    setLines((current) => [...current.slice(-40), { id, text, tone }]);
  }, []);

  const close = useCallback(() => {
    if (cancelHire()) print('^C', 'dim');
    setOpen(false);
    setQuery('');
    setActive(-1);
  }, [print]);

  useEffect(
    () => () => {
      cancelHire();
    },
    []
  );

  /** Flies to a page (leaving the tour or free roam if on), then focuses its heading */
  const navigate = useCallback(
    (href: string) => {
      close();
      navigateFromMode(href);
      if (href !== window.location.pathname) focusHeadingOnArrival(href);
    },
    [close]
  );

  // Global shortcuts: ⌘K / Ctrl+K toggles; Alt+Shift+S toggles the stats overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((current) => !current);
      } else if (e.altKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        statsOverlay.toggle();
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    openListeners.add(onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      openListeners.delete(onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    emitCue('palette');
    document.documentElement.classList.add('palette-open');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('palette-open');
    };
  }, [open]);

  // The page behind holds still: Lenis would otherwise scroll it under a
  // wheel over the backdrop
  useEffect(() => {
    if (!open || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  const { on: soundOn, setSound } = useSound();
  const motionPref = useMotionPref();
  const switchTheme = useCallback(() => {
    toggleTheme();
    emitCue('theme');
  }, [toggleTheme]);
  const enableWorld = useCallback(() => setEnabled(true), [setEnabled]);
  const startTour = useCallback(() => launchWorldMode('tour', enableWorld), [enableWorld]);
  const startExplore = useCallback(() => launchWorldMode('explore', enableWorld), [enableWorld]);

  const hireSequence = useCallback(() => {
    cancelHire();
    const steps: [number, string, Line['tone']][] = [
      [0, '[sudo] password for recruiter: ********', 'dim'],
      [650, 'Verifying clearance… granted.', 'ok'],
      [1200, 'Plotting course to the comms array…', 'dim'],
      [1800, 'Launch sequence armed. Say hello 👋', 'ok'],
    ];
    hire.timers = steps.map(([delay, text, tone]) =>
      window.setTimeout(() => print(text, tone), delay)
    );
    const go = window.setTimeout(() => {
      // Done typing: from here on it isn't cancelled by the palette closing
      hire.timers = [];
      navigate('/contact');
      // Fire the rocket once the camera has arrived (or soon, without the world)
      let fired = false;
      const fire = () => {
        if (fired) return;
        fired = true;
        stop();
        requestLaunch();
      };
      const stop = onFlight((event, to) => {
        if (event === 'end' && to === 'contact') window.setTimeout(fire, 400);
      });
      window.setTimeout(fire, document.querySelector('.world--ready') ? 4200 : 1200);
    }, 2300);
    hire.timers.push(go);
  }, [navigate, print]);

  /** Runs a terminal line; returns true when it handled it */
  const runTerminal = useCallback(
    (raw: string) => {
      const input = raw.trim();
      const [word, ...rest] = input.split(/\s+/);
      const arg = rest.join(' ');
      print(`$ ${input}`, 'input');
      switch (word.toLowerCase()) {
        case 'help':
          print(
            'help · whoami · ls [projects] · cd <page> · sudo hire lewis · tour · explore',
            'dim'
          );
          print('stats · theme · date · ping · echo <text> · clear · exit', 'dim');
          return true;
        case 'whoami':
          print(data.whoami, 'ok');
          return true;
        case 'ls':
          if (arg.startsWith('proj')) data.projects.forEach((p) => print(`  ${p.title}`));
          else print(data.pages.map((p) => p.label.toLowerCase()).join('   '));
          return true;
        case 'cd': {
          const target = data.pages.find(
            (p) => p.label.toLowerCase() === arg.toLowerCase().replace(/^\//, '')
          );
          if (!target && arg !== '~' && arg !== '/') {
            print(`cd: no such page: ${arg || '(none)'}`, 'warn');
            return true;
          }
          navigate(target?.href ?? '/');
          return false;
        }
        case 'sudo':
          if (/^hire\s+lewis/i.test(arg)) hireSequence();
          else
            print('recruiter is not in the sudoers file. This incident will be reported.', 'warn');
          return true;
        case 'clear':
          setLines([]);
          return true;
        case 'exit':
          close();
          return false;
        case 'echo':
          print(arg);
          return true;
        case 'date':
          print(
            new Date().toLocaleString('en-GB', {
              timeZone: 'Europe/London',
              dateStyle: 'full',
              timeStyle: 'short',
            }) + ' (Peterborough)'
          );
          return true;
        case 'ping':
          print('PING peterborough.uk (52.57°N, 0.24°W): 64 bytes, time=0.000042 ly', 'ok');
          return true;
        case 'rm':
          print('Nice try.', 'warn');
          return true;
        case 'tour':
          close();
          startTour();
          return false;
        case 'explore':
          close();
          startExplore();
          return false;
        case 'stats':
          statsOverlay.toggle();
          print(`stats overlay ${statsOverlay.get() ? 'on' : 'off'}`, 'dim');
          return true;
        case 'theme':
          switchTheme();
          return true;
        default:
          print(`command not found: ${word}. Type help.`, 'warn');
          return true;
      }
    },
    [close, data, hireSequence, navigate, print, startExplore, startTour, switchTheme]
  );

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => navigate(href);
    const worldHint = !supported ? 'Unavailable' : enabled ? undefined : 'Turns 3D on';
    /** Where a station is from here: its craft and range, or docked */
    const bearing = (station: StationKey, current: boolean) =>
      current ? 'Docked' : `${stationNames[station].craft} · ${rangeBetween(here, station)} km`;
    return [
      ...data.pages.map((page) => {
        const station = stationForPath(page.href);
        const current = station === here && (page.href !== '/projects' || pathname === page.href);
        return {
          id: `page-${page.href}`,
          group: 'Navigate' as const,
          label: page.label,
          icon: 'ph:arrow-elbow-down-right-bold',
          hint: bearing(station, current),
          station,
          current,
          run: go(page.href),
        };
      }),
      {
        id: 'tour',
        group: 'World',
        label: 'Take the guided tour',
        icon: 'ph:path-bold',
        hint: worldHint,
        keywords: 'fly cinematic autopilot stations',
        run: () => {
          close();
          startTour();
        },
      },
      {
        id: 'explore',
        group: 'World',
        label: 'Explore the world (free flight)',
        icon: 'ph:rocket-launch-bold',
        hint: worldHint,
        keywords: 'fly roam keyboard wasd free',
        run: () => {
          close();
          startExplore();
        },
      },
      {
        id: 'world',
        group: 'World',
        label: enabled ? 'Turn 3D effects off' : 'Turn 3D effects on',
        icon: 'ph:cube-bold',
        keywords: 'webgl world toggle',
        run: () => setEnabled(!enabled),
      },
      {
        id: 'stats',
        group: 'World',
        label: 'Stats for nerds',
        icon: 'ph:chart-line-up-bold',
        hint: '⌥⇧S',
        keywords: 'fps performance debug draw calls',
        run: () => {
          statsOverlay.toggle();
          close();
        },
      },
      {
        id: 'sound',
        group: 'Actions',
        label: soundOn ? 'Turn sound off' : 'Turn sound on',
        icon: soundOn ? 'ph:speaker-simple-x-bold' : 'ph:speaker-high-bold',
        keywords: 'audio music ambience mute volume',
        run: () => setSound(!soundOn),
      },
      {
        id: 'theme',
        group: 'Actions',
        label: 'Toggle light / dark theme',
        icon: 'ph:circle-half-tilt-bold',
        keywords: 'mode colour color',
        run: () => {
          switchTheme();
        },
      },
      ...motionChoices.map(({ pref, label, icon }) => ({
        id: `motion-${pref}`,
        group: 'Actions' as const,
        label,
        icon,
        hint: pref === motionPref ? 'Current' : undefined,
        keywords: 'motion animation reduce reduced calm still accessibility vestibular',
        run: () => {
          setMotionPref(pref);
          return true;
        },
      })),
      {
        id: 'email',
        group: 'Actions',
        label: 'Copy email address',
        icon: 'ph:copy-bold',
        hint: data.email,
        run: () => {
          navigator.clipboard?.writeText(data.email).then(
            () => print(`Copied ${data.email}`, 'ok'),
            () => print(data.email)
          );
          return true;
        },
      },
      {
        id: 'cv',
        group: 'Actions',
        label: 'Download CV',
        icon: 'ph:file-arrow-down-bold',
        hint: 'PDF',
        run: () => {
          const link = document.createElement('a');
          link.href = data.cv.url;
          link.download = data.cv.name;
          link.click();
          close();
        },
      },
      ...data.projects.map((project) => {
        const href = `/projects/${project.slug}`;
        const current = pathname === href;
        const km = rangeBetween(here, 'projects');
        return {
          id: `project-${project.slug}`,
          group: 'Projects' as const,
          label: project.title.trim(),
          icon: 'ph:cube-focus-bold',
          hint: current ? 'Docked' : km ? `${km} km` : undefined,
          station: 'projects' as const,
          current,
          run: go(href),
        };
      }),
      ...data.links.map((link) => ({
        id: `link-${link.name}`,
        group: 'Links' as const,
        label: link.name,
        icon: 'ph:arrow-square-out-bold',
        hint: new URL(link.url).host.replace(/^www\./, ''),
        run: () => {
          window.open(link.url, '_blank', 'noopener,noreferrer');
          close();
        },
      })),
    ];
  }, [
    close,
    data,
    enabled,
    here,
    motionPref,
    navigate,
    pathname,
    print,
    setEnabled,
    setSound,
    soundOn,
    startExplore,
    startTour,
    supported,
    switchTheme,
  ]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const word = q.split(/\s+/)[0];
    const terminal: Command[] =
      q && terminalWords.includes(word)
        ? [
            {
              id: 'terminal',
              group: 'Terminal',
              label: `Run “${query.trim()}”`,
              icon: 'ph:terminal-window-bold',
              hint: '↵',
              run: () => runTerminal(query),
            },
          ]
        : [];
    const matched = commands
      .map((command) => ({
        command,
        rank: Math.max(
          score(command.label, q),
          command.keywords ? score(command.keywords, q) - 1 : 0
        ),
      }))
      .filter((r) => r.rank > 0)
      // Browsing: grouped. Searching: best matches first, then by group
      .sort((a, b) =>
        q
          ? b.rank - a.rank ||
            groupOrder.indexOf(a.command.group) - groupOrder.indexOf(b.command.group)
          : groupOrder.indexOf(a.command.group) - groupOrder.indexOf(b.command.group)
      )
      .map((r) => r.command);
    return [...terminal, ...matched];
  }, [commands, query, runTerminal]);

  const current =
    active < 0 ? firstActive(results) : Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  // The selected row's station: the world plots the course there (the
  // radar, the beacon, the header's aim), after a moment so arrowing down
  // the list doesn't flicker it; none for this station or for other rows,
  // and none once the palette closes
  const previewTo = open ? results[current]?.station : undefined;
  useEffect(() => {
    if (!previewTo || previewTo === here) {
      setPreview('');
      return;
    }
    const id = window.setTimeout(() => setPreview(previewTo), previewDelay);
    return () => window.clearTimeout(id);
  }, [previewTo, here]);
  useEffect(() => {
    if (!open) return;
    return () => setPreview('');
  }, [open]);

  const execute = (command: Command | undefined) => {
    if (!command) {
      if (query.trim()) runTerminal(query);
      setQuery('');
      return;
    }
    const keepOpen = command.run();
    if (command.group === 'Terminal' || keepOpen) setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(results[current]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  let lastGroup: Group | null = null;
  return (
    <div className="palette" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialogRef}
        className="palette__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-lenis-prevent
      >
        <div className="palette__prompt">
          <span className="palette__ps1" aria-hidden="true">
            lewis@orbit:~$
          </span>
          <input
            ref={inputRef}
            className="palette__input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, projects, actions… or type help"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-list`}
            aria-activedescendant={
              results[current] ? `${baseId}-${results[current].id}` : undefined
            }
            aria-autocomplete="list"
            aria-label="Command"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="palette__esc">esc</kbd>
        </div>

        {lines.length > 0 && (
          <div className="palette__term" role="log" aria-live="polite">
            {lines.map((line) => (
              <p key={line.id} className={line.tone ? `palette__line--${line.tone}` : undefined}>
                {line.text}
              </p>
            ))}
          </div>
        )}

        <ul
          ref={listRef}
          id={`${baseId}-list`}
          className="palette__list"
          role="listbox"
          aria-label="Results"
        >
          {results.length === 0 && (
            <li className="palette__empty" role="presentation">
              No matches. Press Enter to run it as a command.
            </li>
          )}
          {results.map((command, i) => {
            // Group headings while browsing; a search is one ranked list
            const heading = !query.trim() && command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {heading && (
                  <span className="palette__group" aria-hidden="true">
                    {heading}
                  </span>
                )}
                <div
                  id={`${baseId}-${command.id}`}
                  className={`palette__item${i === current ? ' is-active' : ''}`}
                  role="option"
                  aria-selected={i === current}
                  data-index={i}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => execute(command)}
                >
                  <Icon icon={command.icon} width={16} height={16} aria-hidden="true" />
                  <span className="palette__label">{command.label}</span>
                  {command.hint && (
                    <span
                      className={`palette__hint${command.current ? ' palette__hint--docked' : ''}`}
                    >
                      {command.hint}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="palette__foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> run
          </span>
          <span>
            <kbd>⌥</kbd>
            <kbd>⇧</kbd>
            <kbd>S</kbd> stats
          </span>
        </p>
      </div>
    </div>
  );
}

export default CommandPalette;
