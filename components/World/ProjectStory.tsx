'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

import type { InspectionProject } from './inspectionTypes';

/** Authored explanations use sample content, never a simulated live service. */
export function ProjectStory({ project }: { project: InspectionProject }) {
  const [step, setStep] = useState(0);
  const [cited, setCited] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const passageRef = useRef<HTMLElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const active = project.steps[step];
  const selectStep = (index: number) => {
    setStep(index);
    setCited(false);
  };

  return (
    <div className="project-story">
      <p className="spatial-inspector__eyebrow">
        How it works · {step + 1} / {project.steps.length}
      </p>
      <ol className="project-story__steps" aria-label="Explanation steps">
        {project.steps.map((item, index) => (
          <li key={item.title}>
            <button
              type="button"
              aria-current={index === step ? 'step' : undefined}
              onClick={() => selectStep(index)}
            >
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="project-story__explanation" aria-live="polite" aria-atomic="true">
        <h3>{active.title}</h3>
        <p>{active.text}</p>
      </div>

      {project.demonstration === 'citations' && (
        <div className="project-story__demo">
          <p className="project-story__caption">Illustrative reading example · sample text</p>
          <div
            className="project-story__document"
            ref={documentRef}
            tabIndex={0}
            aria-label="Sample source document"
          >
            <span className="spatial-inspector__eyebrow">Source document</span>
            <h4>A small reading experiment</h4>
            <p>A team compared two ways to revisit a long research document.</p>
            <p>
              In the first version, readers received a short summary. In the second, answers
              included links to the passages they drew on.
            </p>
            <p>
              <mark ref={passageRef} className={cited ? 'project-story__passage--active' : ''}>
                The second version let readers return directly to the source passage and check the
                answer in context.
              </mark>
            </p>
            <p>
              The example illustrates a citation interaction; it is not a research finding or a
              Sidenote performance claim.
            </p>
          </div>
          <div className="project-story__answer">
            <span className="spatial-inspector__eyebrow">Question</span>
            <p>What did the second version allow readers to do?</p>
            <span className="spatial-inspector__eyebrow">Cited answer</span>
            <p>
              Return to the original passage and check the answer in context.{' '}
              <button
                type="button"
                className="project-story__citation"
                aria-label="Citation 1: highlight the source passage"
                aria-pressed={cited}
                onClick={() => {
                  setCited(true);
                  setStep(project.steps.length - 1);
                  const passage = passageRef.current;
                  const source = documentRef.current;
                  if (passage && source)
                    source.scrollTop = passage.offsetTop - source.offsetTop - 24;
                }}
              >
                [1]
              </button>
            </p>
            <p className="project-story__caption" role="status">
              {cited
                ? 'Citation 1 highlighted in the source document.'
                : 'Select citation [1] to inspect its exact source.'}
            </p>
          </div>
        </div>
      )}

      {project.demonstration === 'modules' && (
        <div className="project-story__demo">
          <p className="project-story__caption">Illustrative form assembly · sample modules</p>
          <div className="project-story__module-picker" aria-label="Available sample modules">
            {['Your details', 'Your enquiry', 'Submit'].map((name) => (
              <button
                key={name}
                type="button"
                disabled={modules.includes(name)}
                onClick={() => setModules([...modules, name])}
              >
                + {name}
              </button>
            ))}
          </div>
          <div className="project-story__assembly" aria-live="polite">
            <span className="spatial-inspector__eyebrow">Editor’s page</span>
            {modules.length ? (
              modules.map((name) => (
                <div className="project-story__module" key={name}>
                  <span>{name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${name} module`}
                    onClick={() => setModules(modules.filter((module) => module !== name))}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p>Choose a module to add it to this sample form.</p>
            )}
            {modules.length === 3 && (
              <p className="project-story__caption">
                Three independent modules assembled on one page. The published Audi capability lets
                editors compose React micro-frontends without writing new code.
              </p>
            )}
          </div>
        </div>
      )}

      {(project.demonstration === 'pipeline' || project.demonstration === 'architecture') && (
        <div className="project-story__demo">
          <p className="project-story__caption">
            {project.demonstration === 'pipeline'
              ? 'Illustrative data flow · no live sanctions check'
              : 'Proposed architecture · design and planning scope'}
          </p>
          <ol
            className="project-story__flow"
            aria-label={
              project.demonstration === 'pipeline'
                ? 'Sanctions data flow'
                : 'Architecture design sequence'
            }
          >
            {project.steps.map((item, index) => (
              <li key={item.title} data-active={index === step ? '' : undefined}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {item.title}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="spatial-inspector__controls">
        <button type="button" disabled={step === 0} onClick={() => selectStep(step - 1)}>
          Previous step
        </button>
        <button
          type="button"
          disabled={step === project.steps.length - 1}
          onClick={() => selectStep(step + 1)}
        >
          Next step
        </button>
      </div>
    </div>
  );
}

export function ProjectScreenshots({ project }: { project: InspectionProject }) {
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const selected = project.images[index];
  if (!selected)
    return (
      <p>
        No public screenshots are included for this project. The brief and explanation describe the
        published scope.
      </p>
    );
  const selectImage = (next: number) => {
    setIndex(next);
    setPosition(0);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  };

  return (
    <div className="project-story__screenshots">
      <p className="project-story__caption">
        Screenshot {index + 1} of {project.images.length} · manual controls
      </p>
      <div
        className={`project-story__screenshot${selected.fullPage ? ' project-story__screenshot--page' : ''}`}
        ref={viewportRef}
        tabIndex={0}
        aria-label={selected.fullPage ? 'Scrollable full-page screenshot' : selected.alt}
        data-lenis-prevent
        onScroll={(event) => {
          const viewport = event.currentTarget;
          const distance = viewport.scrollHeight - viewport.clientHeight;
          setPosition(distance > 0 ? Math.round((viewport.scrollTop / distance) * 100) : 0);
        }}
      >
        <Image
          src={selected.url}
          alt={selected.alt}
          width={selected.width}
          height={selected.height}
          sizes="(max-width: 600px) 90vw, 410px"
        />
      </div>
      {selected.fullPage && (
        <label className="project-story__scroll-label">
          Page position{' '}
          <input
            type="range"
            min="0"
            max="100"
            value={position}
            aria-valuetext={`${position}% down the page`}
            onChange={(event) => {
              const next = Number(event.target.value);
              const viewport = viewportRef.current;
              setPosition(next);
              if (viewport)
                viewport.scrollTop = ((viewport.scrollHeight - viewport.clientHeight) * next) / 100;
            }}
          />
        </label>
      )}
      <div className="spatial-inspector__controls" aria-label="Screenshot selection">
        {project.images.map((image, imageIndex) => (
          <button
            type="button"
            key={image.url}
            aria-label={`Show screenshot ${imageIndex + 1}`}
            aria-pressed={index === imageIndex}
            onClick={() => selectImage(imageIndex)}
          >
            {imageIndex + 1}
          </button>
        ))}
      </div>
      <a
        className="spatial-inspector__text-link"
        href={selected.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open full screenshot <span className="sr-only">(new tab)</span>↗
      </a>
    </div>
  );
}
