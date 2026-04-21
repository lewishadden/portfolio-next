'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Icon } from '@iconify/react';

import { Projects as ProjectsProps, Project } from '@/types';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';

import './Projects.scss';

export const Projects = ({ projects }: { projects: ProjectsProps }) => {
  const { title, label, items } = projects;
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <section id="projects" className="section projects" aria-labelledby="projects-heading">
      <div className="section__num">03</div>
      <div className="section__head section__head--centered reveal">
        <span className="section__label section__label--centered">{label}</span>
        <h2 id="projects-heading" className="section__title">
          <span className="section__title-accent">Selected</span> {title}
        </h2>
        <p className="section__sub">
          A cross-section of platforms, tools, and architectures — from passion projects to
          enterprise-grade applications shipped in production.
        </p>
      </div>

      <div className="projects__editorial">
        {items.map((p, i) => {
          const preview = p.images?.[0];
          const techSummary = p.technologies
            .slice(0, 3)
            .map((t) => t.name)
            .join(' · ');

          return (
            <button
              key={p.title}
              type="button"
              className="proj-row reveal"
              onClick={() => setSelectedProject(p)}
              aria-label={`View details for ${p.title}`}
            >
              <span className="proj-row__num">{String(i + 1).padStart(2, '0')}</span>
              <div className="proj-row__text">
                <h3 className="proj-row__title">{p.title}</h3>
                <p className="proj-row__sub">{techSummary}</p>
              </div>
              <div className="proj-row__meta">
                <b>{p.startDate}</b>
              </div>
              <div className="proj-row__cta">
                View <Icon icon="ph:arrow-up-right" width={14} height={14} aria-hidden="true" />
              </div>
              {preview && (
                <div className="proj-row__preview" aria-hidden="true">
                  <Image
                    src={preview.url}
                    alt=""
                    width={preview.size.width}
                    height={preview.size.height}
                    sizes="260px"
                    loading="lazy"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedProject && (
        <ProjectDetailsModal
          show={!!selectedProject}
          data={selectedProject}
          onHide={() => setSelectedProject(null)}
        />
      )}
    </section>
  );
};

export default Projects;
