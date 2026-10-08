'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useLenis } from 'lenis/react';

import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useWorldPreference } from '@/hooks/useWorldPreference';
import { closeInspection, inspectEntity, useInspection } from './inspection';
import { ProjectScreenshots, ProjectStory } from './ProjectStory';
import { requestLaunch } from './worldStore';
import { launchWorldMode } from './worldMode';

import type { InspectionCatalog, InspectionProject, InspectionSelection } from './inspectionTypes';
import type { StationKey } from './routes';

import './SpatialInspector.scss';

// Formik and validation remain out of the initial world chunk.
const ContactForm = dynamic(() => import('@/components/Contact/ContactForm/ContactForm'));

const stationTitles: Record<StationKey, string> = {
  home: 'Gateway orientation',
  about: 'Crew dossier',
  experience: 'Mission logs',
  projects: 'Project archive',
  skills: 'Research evidence',
  contact: 'Comms terminal',
  lost: 'Uncharted sector',
};

function Tabs({ labels, selected, onSelect }: { labels: string[]; selected: number; onSelect: (index: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="spatial-inspector__tabs" ref={ref} role="tablist" aria-label="Inspection sections" onKeyDown={(event) => {
      const next = event.key === 'ArrowRight' ? (selected + 1) % labels.length : event.key === 'ArrowLeft' ? (selected + labels.length - 1) % labels.length : event.key === 'Home' ? 0 : event.key === 'End' ? labels.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      onSelect(next);
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>
      {labels.map((label, index) => <button key={label} id={`inspection-tab-${index}`} type="button" role="tab" aria-selected={selected === index} aria-controls="inspection-tabpanel" tabIndex={selected === index ? 0 : -1} onClick={() => onSelect(index)}>{label}</button>)}
    </div>
  );
}

function ProjectInspection({ project }: { project: InspectionProject }) {
  const [tab, setTab] = useState(0);
  return <>
    <Tabs labels={['Brief', 'How it works', 'Screenshots']} selected={tab} onSelect={setTab} />
    <div id="inspection-tabpanel" role="tabpanel" aria-labelledby={`inspection-tab-${tab}`} tabIndex={0}>
      {tab === 0 && <>
        <dl className="spatial-inspector__brief">
          <dt>Problem</dt><dd>{project.problem}</dd>
          <dt>My contribution</dt><dd>{project.contribution}</dd>
          <dt>Result</dt><dd>{project.result}</dd>
        </dl>
        <ul className="spatial-inspector__tags" aria-label="Project technologies">{project.technologies.map((technology) => <li key={technology}>{technology}</li>)}</ul>
      </>}
      {tab === 1 && <ProjectStory project={project} />}
      {tab === 2 && <ProjectScreenshots project={project} />}
    </div>
    <div className="spatial-inspector__links">
      <Link href={project.href} className="spatial-inspector__text-link">Read full case study →</Link>
      {project.url && <a href={project.url} target="_blank" rel="noopener noreferrer" className="spatial-inspector__text-link">Visit project <span className="sr-only">(new tab)</span>↗</a>}
    </div>
  </>;
}

function ProjectEvidence({ ids, catalog }: { ids: string[]; catalog: InspectionCatalog }) {
  return <ul className="spatial-inspector__evidence">{ids.map((id) => {
    const project = catalog.projects.find((item) => item.id === id);
    if (!project) return null;
    return <li key={id}><button type="button" onClick={() => inspectEntity({ kind: 'project', id, station: 'projects' })}><span>{project.title}</span><span className="spatial-inspector__evidence-detail">{project.contribution}</span><span className="spatial-inspector__evidence-action">Inspect project ↗</span></button></li>;
  })}</ul>;
}

function RoleEvidence({ ids, catalog }: { ids: string[]; catalog: InspectionCatalog }) {
  return <ul className="spatial-inspector__evidence">{ids.map((id) => {
    const role = catalog.roles.find((item) => item.id === id);
    if (!role) return null;
    return <li key={id}><button type="button" onClick={() => inspectEntity({ kind: 'role', id, station: 'experience' })}><span>{role.title}</span><span className="spatial-inspector__evidence-detail">{role.company} · {role.years}</span><span className="spatial-inspector__evidence-action">Read mission log ↗</span></button></li>;
  })}</ul>;
}

function AboutInspection({ catalog }: { catalog: InspectionCatalog }) {
  const [tab, setTab] = useState(0);
  const [transmission, setTransmission] = useState(0);
  const { about } = catalog;
  const recommendation = about.recommendations[transmission];
  return <>
    <Tabs labels={['Dossier', 'Transmissions']} selected={tab} onSelect={setTab} />
    <div id="inspection-tabpanel" role="tabpanel" aria-labelledby={`inspection-tab-${tab}`} tabIndex={0}>
      {tab === 0 ? <>
        <div className="spatial-inspector__portrait"><Image src={about.portrait} alt={about.name} width={160} height={180} sizes="100px" /><div><span className="spatial-inspector__eyebrow">Crew profile</span><h3>{about.name}</h3><a href={about.cv.url} download={about.cv.name}>Download CV ↓</a></div></div>
        <div className="spatial-inspector__biography" dangerouslySetInnerHTML={{ __html: about.description }} />
        <div className="spatial-inspector__highlights">{about.highlights.map((highlight) => <details key={highlight.title}><summary>{highlight.title}</summary><p>{highlight.sub}</p></details>)}</div>
      </> : <>
        <p className="spatial-inspector__eyebrow">Recommendations · quoted verbatim</p>
        {about.recommendations.length > 0 && <div className="spatial-inspector__controls">{about.recommendations.map((item, index) => <button key={item.name} type="button" aria-pressed={transmission === index} onClick={() => setTransmission(index)}>{item.name}</button>)}</div>}
        {recommendation ? <figure className="spatial-inspector__quote"><blockquote>{recommendation.text.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</blockquote><figcaption><strong>{recommendation.name}</strong><span>{recommendation.title}, {recommendation.company}</span><span>{recommendation.relationship}</span><a href={recommendation.source.url} target="_blank" rel="noopener noreferrer">{recommendation.source.label} recommendation <span className="sr-only">(new tab)</span>↗</a></figcaption></figure> : <p>No published recommendations yet.</p>}
      </>}
    </div>
  </>;
}

function ContactInspection({ catalog }: { catalog: InspectionCatalog }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<{ limited: boolean } | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submitted) statusRef.current?.focus({ preventScroll: true });
  }, [submitted]);
  useEffect(() => {
    if (!error) return;
    const panel = errorRef.current?.closest<HTMLElement>('.spatial-inspector__body');
    if (panel) panel.scrollTop = 0;
    errorRef.current?.focus({ preventScroll: true });
  }, [error]);
  const { contact } = catalog;
  const errorContent = error?.limited ? contact.rateLimited : contact.error;
  return <div className="spatial-inspector__contact">
    <p>{contact.contactInfo.description}</p>
    <address className="spatial-inspector__contact-links">{contact.contactInfo.items.filter((item) => item.name === 'Email' || item.name === 'Phone').map((item) => <a key={item.name} href={item.link}>{item.value}</a>)}</address>
    {submitted ? <div className="spatial-inspector__status" role="status" ref={statusRef} tabIndex={-1}><span className="spatial-inspector__eyebrow">Transmission received</span><h3>{contact.success.headerText}</h3><p>{contact.success.bodyText}</p><button type="button" onClick={() => setSubmitted(false)}>{contact.sendAgain.text}</button></div> : <>
      {error && <div className="spatial-inspector__error" ref={errorRef} tabIndex={-1} role="alert"><strong>{errorContent.headerText}</strong><p>{errorContent.bodyText}</p></div>}
      <ContactForm idPrefix="inspection-" contact={contact} onSuccess={() => { setError(null); setSubmitted(true); requestLaunch(); }} onFail={(response) => setError({ limited: response.status === 429 })} />
    </>}
  </div>;
}

function HomeInspection({ catalog }: { catalog: InspectionCatalog }) {
  const { supported, setEnabled } = useWorldPreference();
  return <>
    <p>Choose a destination to dock, or open an artifact to inspect the work.</p>
    <nav aria-label="Station destinations"><ul className="spatial-inspector__evidence">{catalog.destinations.map((destination) => <li key={destination.href}><Link href={destination.href}><span>{destination.title}</span><span className="spatial-inspector__evidence-detail">{destination.text}</span></Link></li>)}</ul></nav>
    {supported && <div className="spatial-inspector__controls"><button type="button" onClick={() => { closeInspection({ replace: true }); launchWorldMode('tour', () => setEnabled(true)); }}>Start guided tour</button></div>}
    <h3>Featured project</h3><ProjectEvidence ids={['sidenote']} catalog={catalog} />
  </>;
}

function InspectionBody({ selection, catalog }: { selection: InspectionSelection; catalog: InspectionCatalog }) {
  if (selection.kind === 'project') {
    const project = catalog.projects.find(({ id }) => id === selection.id);
    return project ? <ProjectInspection project={project} /> : <p>This project is not in the published archive.</p>;
  }
  if (selection.kind === 'role') {
    const role = catalog.roles.find(({ id }) => id === selection.id);
    return role ? <>
      <p className="spatial-inspector__eyebrow">{role.company} · {role.years}</p><p>{role.description}</p>
      <h3>Tools used in this role</h3><ul className="spatial-inspector__tags">{role.technologies.map((technology) => <li key={technology}>{technology}</li>)}</ul>
      {role.projects.length > 0 && <><h3>Linked work</h3><ProjectEvidence ids={role.projects} catalog={catalog} /></>}
      <Link href="/experience" className="spatial-inspector__text-link">Read full timeline →</Link>
    </> : <p>This role is not in the published timeline.</p>;
  }
  if (selection.kind === 'skill') {
    const skill = catalog.skills.find(({ id }) => id === selection.id);
    return skill ? <>
      <p className="spatial-inspector__eyebrow">{skill.category} · evidence</p>
      <p>Projects and roles that name {skill.name} in the published portfolio.</p>
      {skill.projects.length > 0 && <><h3>Projects</h3><ProjectEvidence ids={skill.projects} catalog={catalog} /></>}
      {skill.roles.length > 0 && <><h3>Experience</h3><RoleEvidence ids={skill.roles} catalog={catalog} /></>}
      {!skill.projects.length && !skill.roles.length && <p>This tool is listed in the toolkit; a specific project or role is not documented yet.</p>}
      <Link href="/skills" className="spatial-inspector__text-link">Browse the toolkit →</Link>
    </> : <p>This tool is not in the published toolkit.</p>;
  }
  if (selection.station === 'about') return <AboutInspection catalog={catalog} />;
  if (selection.station === 'contact') return <ContactInspection catalog={catalog} />;
  if (selection.station === 'experience') return <RoleEvidence ids={catalog.roles.map(({ id }) => id)} catalog={catalog} />;
  if (selection.station === 'projects') return <ProjectEvidence ids={catalog.projects.map(({ id }) => id)} catalog={catalog} />;
  if (selection.station === 'skills') return <ul className="spatial-inspector__evidence">{catalog.skills.map((skill) => <li key={skill.id}><button type="button" onClick={() => inspectEntity({ kind: 'skill', id: skill.id, station: 'skills' })}><span>{skill.name}</span><span className="spatial-inspector__evidence-detail">{skill.projects.length} projects · {skill.roles.length} roles</span></button></li>)}</ul>;
  return <HomeInspection catalog={catalog} />;
}

/** One semantic dialog, outside the canvas's aria-hidden subtree. */
export function SpatialInspector({ catalog }: { catalog: InspectionCatalog }) {
  const selection = useInspection();
  const panelRef = useFocusTrap<HTMLDivElement>(!!selection);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectionKey = selection ? `${selection.kind}:${selection.id}` : '';
  const open = !!selection;
  const lenis = useLenis();

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousGutter = root.style.scrollbarGutter;
    const wasStopped = lenis?.isStopped;
    const lockedY = window.scrollY;
    const holdScroll = () => {
      if (window.scrollY !== lockedY) window.scrollTo({ top: lockedY, behavior: 'instant' });
    };
    root.style.overflow = 'hidden';
    root.style.scrollbarGutter = 'stable';
    lenis?.stop();
    window.addEventListener('scroll', holdScroll);
    return () => {
      window.removeEventListener('scroll', holdScroll);
      root.style.overflow = previousOverflow;
      root.style.scrollbarGutter = previousGutter;
      if (!wasStopped) lenis?.start();
    };
  }, [open, lenis]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const resize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      panel.style.setProperty('--inspection-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      panel.style.setProperty('--inspection-keyboard-offset', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
      panel.style.setProperty('--inspection-top-gap', viewport && viewport.height < window.innerHeight - 80 ? '24px' : '100px');
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, [open, panelRef]);

  useEffect(() => {
    if (selectionKey) closeRef.current?.focus({ preventScroll: true });
  }, [selectionKey]);

  if (!selection) return null;
  const title = selection.kind === 'project' ? catalog.projects.find(({ id }) => id === selection.id)?.title : selection.kind === 'role' ? catalog.roles.find(({ id }) => id === selection.id)?.title : selection.kind === 'skill' ? catalog.skills.find(({ id }) => id === selection.id)?.name : stationTitles[selection.station];

  return <>
    <svg className="spatial-inspector__leader" aria-hidden="true"><line data-inspection-leader /><circle data-inspection-anchor r="4" /></svg>
    <div
      className="spatial-inspector"
      data-inspection-panel
      data-world-input-owner="inspection"
      data-lenis-prevent
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspection-heading"
      tabIndex={-1}
    >
      <header className="spatial-inspector__header">
        <div><p className="spatial-inspector__eyebrow">{selection.station} / {selection.kind === 'station' ? 'station console' : selection.kind}</p><h2 id="inspection-heading">{title ?? 'Inspection'}</h2></div>
        <button ref={closeRef} type="button" className="spatial-inspector__close" onClick={() => closeInspection()} aria-label="Close inspection">×</button>
      </header>
      <div className="spatial-inspector__body" key={selectionKey}><InspectionBody selection={selection} catalog={catalog} /></div>
      <footer className="spatial-inspector__footer"><span>Artifact inspection</span><span>Esc to return</span></footer>
    </div>
  </>;
}
