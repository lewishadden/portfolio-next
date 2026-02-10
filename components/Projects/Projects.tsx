'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

import { BasicInfo, Project } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';

import './Projects.scss';

const MAX_DESCRIPTION_LENGTH = 100;
const MAX_TECH_PREVIEW = 4;
const STAGGER_DELAY = 0.1;

const BREAKPOINTS = [
  { min: 1200, cols: 3 },
  { min: 768, cols: 2 },
  { min: 0, cols: 1 },
];

const getColumns = (width: number) =>
  (BREAKPOINTS.find((bp) => width >= bp.min) ?? BREAKPOINTS[BREAKPOINTS.length - 1]).cols;

/**
 * Splits items into rows with a reverse-pyramid taper at the bottom.
 * Full rows fill to `cols`. When there is a remainder, one full row is
 * borrowed and combined with the leftover to form two balanced, centered
 * taper rows (e.g. 3+1 → 2+2).
 */
const buildPyramidRows = <T,>(items: T[], cols: number): T[][] => {
  const total = items.length;
  if (total === 0) return [];

  const rows: T[][] = [];
  const remainder = total % cols;
  let offset = 0;

  if (remainder === 0) {
    for (let r = 0; r < total / cols; r += 1) {
      rows.push(items.slice(offset, offset + cols));
      offset += cols;
    }
    return rows;
  }

  const fullRowsAvailable = Math.floor(total / cols);

  // Not enough items for even one full row — single centered row
  if (fullRowsAvailable === 0) {
    return [items.slice(0)];
  }

  // Borrow one full row; split pool into two balanced taper rows
  const fullRowCount = fullRowsAvailable - 1;
  const pool = cols + remainder;
  const firstTaper = Math.ceil(pool / 2);
  const secondTaper = pool - firstTaper;

  for (let r = 0; r < fullRowCount; r += 1) {
    rows.push(items.slice(offset, offset + cols));
    offset += cols;
  }

  rows.push(items.slice(offset, offset + firstTaper));
  offset += firstTaper;

  if (secondTaper > 0) {
    rows.push(items.slice(offset, offset + secondTaper));
  }

  return rows;
};

const truncateDescription = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, text.lastIndexOf(' ', maxLength))}…`;
};

export const Projects = ({
  projects,
  basicInfo,
}: {
  basicInfo: BasicInfo;
  projects: Project[];
}) => {
  const [deps, setDeps] = useState<Project | null>(null);
  const [detailsModalShow, setDetailsModalShow] = useState(false);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const update = () => setColumns(getColumns(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const headingText = basicInfo.sectionName.projects;

  const showDetailsModal = (data: Project) => {
    setDeps(data);
    setDetailsModalShow(true);
  };

  const detailsModalClose = () => {
    setDetailsModalShow(false);
    setDeps(null);
  };

  const pyramidRows = buildPyramidRows(projects, columns);
  let globalIndex = 0;

  return (
    <section id="projects" className="projects" aria-labelledby="projects-heading">
      <div className="projects__container">
        <div className="projects__heading-wrapper">
          <span className="projects__label">What I&rsquo;ve built</span>
          <h2 id="projects-heading" className="projects__heading">
            {headingText}
          </h2>
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
                      delay={i * STAGGER_DELAY}
                      style={{ flex: 1, display: 'flex' }}
                    >
                      <button
                        type="button"
                        className="projects__item__card"
                        onClick={() => showDetailsModal(project)}
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

                              <span
                                className="projects__item__card__date"
                                aria-label={`Started in ${project.startDate}`}
                              >
                                {project.startDate}
                              </span>
                            </div>
                          </div>

                          <p className="projects__item__card__description">
                            {truncateDescription(project.description, MAX_DESCRIPTION_LENGTH)}
                          </p>

                          <div
                            className="projects__item__card__tech"
                            aria-label="Technologies used"
                          >
                            {project.technologies.slice(0, MAX_TECH_PREVIEW).map((tech) => (
                              <span key={tech.name} className="projects__item__card__tech__pill">
                                <Icon icon={tech.class} aria-hidden="true" />
                                {tech.name}
                              </span>
                            ))}
                            {project.technologies.length > MAX_TECH_PREVIEW && (
                              <span className="projects__item__card__tech__pill projects__item__card__tech__pill--more">
                                +{project.technologies.length - MAX_TECH_PREVIEW}
                              </span>
                            )}
                          </div>

                          <div className="projects__item__card__cta">
                            <span>View Details</span>
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
        {deps && (
          <ProjectDetailsModal show={detailsModalShow} onHide={detailsModalClose} data={deps} />
        )}
      </div>
    </section>
  );
};

export default Projects;
