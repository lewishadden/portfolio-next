'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';

import { useSound } from 'components/Sound/sound';
import { statsOverlay } from 'components/StatsOverlay/statsStore';
import { launchWorldMode } from 'components/World/worldMode';
import { onFlight, requestLaunch } from 'components/World/worldStore';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useWorldPreference } from '@/hooks/useWorldPreference';

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
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const { enabled, supported, setEnabled } = useWorldPreference();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const baseId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const print = useCallback((text: string, tone?: Line['tone']) => {
    const id = nextLineId();
    setLines((current) => [...current.slice(-40), { id, text, tone }]);
  }, []);

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
    document.documentElement.classList.add('palette-open');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove('palette-open');
    };
  }, [open]);

  const { on: soundOn, setSound } = useSound();
  const enableWorld = useCallback(() => setEnabled(true), [setEnabled]);
  const startTour = useCallback(() => launchWorldMode('tour', enableWorld), [enableWorld]);
  const startExplore = useCallback(() => launchWorldMode('explore', enableWorld), [enableWorld]);

  const hireSequence = useCallback(() => {
    const steps: [number, string, Line['tone']][] = [
      [0, '[sudo] password for recruiter: ********', 'dim'],
      [650, 'Verifying clearance… granted.', 'ok'],
      [1200, 'Plotting course to the comms array…', 'dim'],
      [1800, 'Launch sequence armed. Say hello 👋', 'ok'],
    ];
    steps.forEach(([delay, text, tone]) => window.setTimeout(() => print(text, tone), delay));
    window.setTimeout(() => {
      close();
      router.push('/contact');
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
  }, [close, print, router]);

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
          close();
          router.push(target?.href ?? '/');
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
          toggleTheme();
          return true;
        default:
          print(`command not found: ${word}. Type help.`, 'warn');
          return true;
      }
    },
    [close, data, hireSequence, print, router, startExplore, startTour, toggleTheme]
  );

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    const worldHint = !supported ? 'Unavailable' : enabled ? undefined : 'Turns 3D on';
    return [
      ...data.pages.map((page, i) => ({
        id: `page-${page.href}`,
        group: 'Navigate' as const,
        label: page.label,
        icon: 'ph:arrow-elbow-down-right-bold',
        hint: String(i).padStart(2, '0'),
        run: go(page.href),
      })),
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
          toggleTheme();
        },
      },
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
      ...data.projects.map((project) => ({
        id: `project-${project.slug}`,
        group: 'Projects' as const,
        label: project.title.trim(),
        icon: 'ph:cube-focus-bold',
        run: go(`/projects/${project.slug}`),
      })),
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
    print,
    router,
    setEnabled,
    setSound,
    soundOn,
    startExplore,
    startTour,
    supported,
    toggleTheme,
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

  const current = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [current]);

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
        className="palette__dialog glass"
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
              setActive(0);
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
                  {command.hint && <span className="palette__hint">{command.hint}</span>}
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
