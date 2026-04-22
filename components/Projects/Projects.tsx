'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';
import Magnet from 'components/Magnet/Magnet';

import { Projects as ProjectsProps, Project } from '@/types';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';

import './Projects.scss';

export const Projects = ({ projects }: { projects: ProjectsProps }) => {
  const { title, label, items } = projects;
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <section id="projects" className="section projects" aria-labelledby="projects-heading">
      <div className="section__num">03</div>
      <ScrollReveal className="section__head section__head--centered">
        <span className="section__label section__label--centered">{label}</span>
        <h2 id="projects-heading" className="section__title">
          <span className="section__title-accent">Selected</span> {title}
        </h2>
        <p className="section__sub">
          A cross-section of platforms, tools, and architectures — from passion projects to
          enterprise-grade applications shipped in production.
        </p>
      </ScrollReveal>

      <div className="projects__editorial">
        {items.map((p, i) => {
          const preview = p.images?.[0];
          const techSummary = p.technologies
            .slice(0, 3)
            .map((t) => t.name)
            .join(' · ');

          return (
            <ScrollReveal
              as="button"
              key={p.title}
              type="button"
              className="proj-row"
              onClick={() => setSelectedProject(p)}
              aria-label={`View details for ${p.title}`}
              onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
              }}
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
              <div
                className={`proj-row__preview${preview ? '' : ' proj-row__preview--placeholder'}`}
                aria-hidden="true"
              >
                {preview ? (
                  <Image
                    src={preview.url}
                    alt=""
                    width={preview.size.width}
                    height={preview.size.height}
                    sizes="260px"
                    loading="lazy"
                  />
                ) : (
                  <Icon icon="ph:code" width={32} height={32} />
                )}
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      <ScrollReveal className="section__page-nav">
        <Magnet>
          <Link href="/contact" className="btn btn--primary">
            <Icon icon="ph:envelope-simple" width={18} height={18} aria-hidden="true" />
            <span>Work Together</span>
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/skills" className="btn btn--secondary">
            <Icon icon="ph:stack" width={18} height={18} aria-hidden="true" />
            <span>Explore Skills</span>
          </Link>
        </Magnet>
      </ScrollReveal>

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
