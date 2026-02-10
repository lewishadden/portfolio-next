'use client';

import { useState } from 'react';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { Icon } from '@iconify/react';

import { BasicInfo, Project } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';

import './Projects.scss';

const MAX_DESCRIPTION_LENGTH = 100;
const MAX_TECH_PREVIEW = 4;
const STAGGER_DELAY = 0.1;

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

  const headingText = basicInfo.sectionName.projects;

  const showDetailsModal = (data: Project) => {
    setDeps(data);
    setDetailsModalShow(true);
  };

  const detailsModalClose = () => {
    setDetailsModalShow(false);
    setDeps(null);
  };

  const ProjectCards = () =>
    projects.map((project, index) => (
      <li key={project.title} className="projects__item">
        <ScrollReveal
          animation="fadeInUp"
          delay={index * STAGGER_DELAY}
          style={{ flex: 1, display: 'flex' }}
        >
          <Card
            as="button"
            type="button"
            text={project.theme.text}
            className="projects__item__card"
            onClick={() => showDetailsModal(project)}
            aria-label={`View details for ${project.title} project`}
          >
            <Card.Body className="projects__item__card__body">
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
                  <Card.Title as="h3" className="projects__item__card__title font-trebuchet">
                    {project.title}
                  </Card.Title>

                  <Badge
                    className="projects__item__card__date"
                    aria-label={`Started in ${project.startDate}`}
                  >
                    {project.startDate}
                  </Badge>
                </div>
              </div>

              <p className="projects__item__card__description">
                {truncateDescription(project.description, MAX_DESCRIPTION_LENGTH)}
              </p>

              <div className="projects__item__card__tech" aria-label="Technologies used">
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
            </Card.Body>
          </Card>
        </ScrollReveal>
      </li>
    ));

  return (
    <section id="projects" className="projects" aria-labelledby="projects-heading">
      <Container>
        <Row>
          <Col md={12}>
            <div className="projects__heading-wrapper">
              <span className="projects__label">What I&rsquo;ve built</span>
              <h2 id="projects-heading" className="projects__heading">
                {headingText}
              </h2>
            </div>
          </Col>
        </Row>
        <ul className="projects__list list-unstyled" aria-label="Project portfolio">
          {projects.length > 0 && <ProjectCards />}
        </ul>
        {deps && (
          <ProjectDetailsModal show={detailsModalShow} onHide={detailsModalClose} data={deps} />
        )}
      </Container>
    </section>
  );
};

export default Projects;
