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

      <div className="projects__bento">
        {items.map((p, i) => {
          const preview = p.images?.[0];
          const featured = i === 0 || i === 3 || i === 8;
          const techSummary = p.technologies.slice(0, 4);
          const descriptionSnippet =
            p.description.length > 120 ? `${p.description.slice(0, 120)}…` : p.description;

          return (
            <ScrollReveal
              as="button"
              key={p.title}
              type="button"
              className={`proj-card${featured ? ' proj-card--featured' : ''}`}
              onClick={() => setSelectedProject(p)}
              aria-label={`View details for ${p.title}`}
              style={{ '--reveal-delay': `${(i % 3) * 100}ms` } as React.CSSProperties}
              onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
              }}
            >
              <div
                className={`proj-card__image${!preview ? ' proj-card__image--placeholder' : ''}`}
              >
                {preview ? (
                  <Image
                    src={preview.url}
                    alt=""
                    width={preview.size.width}
                    height={preview.size.height}
                    sizes={
                      featured
                        ? '(min-width: 900px) 720px, 100vw'
                        : '(min-width: 900px) 380px, 100vw'
                    }
                    loading={i < 4 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <Icon icon={p.thumbnail || 'ph:code'} width={48} height={48} />
                )}
              </div>
              <div className="proj-card__body">
                <div className="proj-card__header">
                  <h3 className="proj-card__title">{p.title}</h3>
                  <span className="proj-card__year">{p.startDate}</span>
                </div>
                <p className="proj-card__desc">{descriptionSnippet}</p>
                <div className="proj-card__footer">
                  <div className="proj-card__tech">
                    {techSummary.map((t) => (
                      <span className="chip" key={t.name}>
                        <Icon icon={t.class} width={14} height={14} aria-hidden="true" />
                        {t.name}
                      </span>
                    ))}
                  </div>
                  <span className="proj-card__cta">
                    View <Icon icon="ph:arrow-up-right" width={14} height={14} aria-hidden="true" />
                  </span>
                </div>
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
