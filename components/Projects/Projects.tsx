'use client';

import { useRef, useState } from 'react';
import { Icon } from '@iconify/react';

import { useColumns } from '@/hooks/useColumns';
import { buildPyramidRows } from '@/utils/buildPyramidRows';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';

import { Projects as ProjectsProps, Project } from '@/types';

import './Projects.scss';

const maxDescriptionLength = 100;
const maxTechPreview = 4;
const staggerDelay = 0.1;

const breakpoints = [
  { min: 1200, cols: 3 },
  { min: 768, cols: 2 },
  { min: 0, cols: 1 },
];

const truncateDescription = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, text.lastIndexOf(' ', maxLength))}…`;
};

export const Projects = ({ projects }: { projects: ProjectsProps }) => {
  const { title, label, items, ctaText } = projects;

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailsModalShow, setDetailsModalShow] = useState(false);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const columns = useColumns(breakpoints);

  const showDetailsModal = (data: Project, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setSelectedProject(data);
    setDetailsModalShow(true);
  };

  const detailsModalClose = () => {
    setDetailsModalShow(false);
    setSelectedProject(null);
    requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
      lastTriggerRef.current = null;
    });
  };

  const pyramidRows = buildPyramidRows(items, columns);
  let globalIndex = 0;

  return (
    <section id="projects" className="projects" aria-labelledby="projects-heading">
      <div className="projects__container">
        <div className="projects__heading-wrapper">
          <ScrollReveal animation="slideUp">
            <span className="projects__label">{label}</span>
          </ScrollReveal>
          <ScrollReveal animation="slideUp" delay={0.1}>
            <h2 id="projects-heading" className="projects__heading">
              {title}
            </h2>
          </ScrollReveal>
        </div>
        <div className="projects__list" role="list" aria-label="Project portfolio">
          {pyramidRows.map((row, rowIndex) => (
            <div key={rowIndex} className="projects__list__row">
              {row.map((project) => {
                const i = globalIndex;
                globalIndex += 1;
                return (
                  <div key={project.title} className="projects__item" role="listitem">
                    <ScrollReveal
                      animation="fadeInUp"
                      delay={i * staggerDelay}
                      style={{ flex: 1, display: 'flex' }}
                    >
                      <button
                        type="button"
                        className="projects__item__card"
                        onClick={(e) => showDetailsModal(project, e.currentTarget)}
                        aria-label={`View details for ${project.title} project`}
                      >
                        <div className="projects__item__card__body">
                          <div className="projects__item__card__top">
                            <div className="projects__item__card__icon-wrapper">
                              <Icon
                                icon={project.thumbnail}
                                className="projects__item__card__thumbnail"
                                aria-hidden="true"
                              />
                              <div className="projects__item__card__icon-glow" />
                            </div>

                            <div className="projects__item__card__header">
                              <h3 className="projects__item__card__title font-trebuchet">
                                {project.title}
                              </h3>

                              <time
                                className="projects__item__card__date"
                                dateTime={project.startDate}
                              >
                                {project.startDate}
                              </time>
                            </div>
                          </div>

                          <p className="projects__item__card__description">
                            {truncateDescription(project.description, maxDescriptionLength)}
                          </p>

                          <ul className="projects__item__card__tech" aria-label="Technologies used">
                            {project.technologies.slice(0, maxTechPreview).map((tech) => (
                              <li key={tech.name} className="projects__item__card__tech__pill">
                                <Icon icon={tech.class} aria-hidden="true" />
                                {tech.name}
                              </li>
                            ))}
                            {project.technologies.length > maxTechPreview && (
                              <li className="projects__item__card__tech__pill projects__item__card__tech__pill--more">
                                +{project.technologies.length - maxTechPreview}
                              </li>
                            )}
                          </ul>

                          <div className="projects__item__card__cta">
                            <span>{ctaText}</span>
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <path
                                d="M5 12H19M19 12L13 6M19 12L13 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </button>
                    </ScrollReveal>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {selectedProject && (
          <ProjectDetailsModal
            show={detailsModalShow}
            onHide={detailsModalClose}
            data={selectedProject}
          />
        )}
      </div>
    </section>
  );
};

export default Projects;
