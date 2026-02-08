'use client';

import { useState } from 'react';
import { Container, Row, Col, Stack, Card, Badge } from 'react-bootstrap';
import { Icon } from '@iconify/react';

import { BasicInfo, Project } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';

import './Projects.scss';

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
    projects.map((project) => (
      <Col as="li" key={project.title} className="projects__item my-3 px-3">
        <ScrollReveal animation="fadeIn">
          <Card
            as="button"
            type="button"
            text={project.theme.text}
            className="projects__item__picture-card mx-auto"
            onClick={() => showDetailsModal(project)}
            aria-label={`View details for ${project.title} project`}
          >
            <Card.Body className="projects__item__picture-card__body">
              <div className="projects__item__picture-card__icon-wrapper">
                <Icon
                  icon={project.thumbnail}
                  className="projects__item__picture-card__thumbnail"
                  aria-hidden="true"
                />
                <div className="projects__item__picture-card__icon-glow"></div>
              </div>

              <Card.Title as="h3" className="projects__item__picture-card__title font-trebuchet">
                {project.title}
              </Card.Title>

              <Badge
                className="projects__item__picture-card__date"
                aria-label={`Started in ${project.startDate}`}
              >
                {project.startDate}
              </Badge>

              <div className="projects__item__picture-card__cta">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M13 9L16 12M16 12L13 15M16 12H8M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>View Details</span>
              </div>
            </Card.Body>
          </Card>
        </ScrollReveal>
      </Col>
    ));

  return (
    <section id="projects" className="projects" aria-labelledby="projects-heading">
      <Container>
        <Row>
          <Col md={12}>
            <div className="projects__heading-wrapper">
              <h2 id="projects-heading" className="projects__heading">
                {headingText}
              </h2>
              <div className="projects__heading-underline"></div>
            </div>
          </Col>
        </Row>
        <Row
          as="ul"
          xs={1}
          sm={1}
          md={2}
          lg={2}
          xl={3}
          className="projects__list center list-unstyled"
          aria-label="Project portfolio"
        >
          {projects.length > 0 && <ProjectCards />}
        </Row>
        {deps && (
          <ProjectDetailsModal show={detailsModalShow} onHide={detailsModalClose} data={deps} />
        )}
      </Container>
    </section>
  );
};

export default Projects;
