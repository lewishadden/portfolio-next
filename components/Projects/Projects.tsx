'use client';

import { useState } from 'react';
import { Container, Row, Col, Stack, Card, Badge } from 'react-bootstrap';
import { Icon } from '@iconify/react';
import ScrollAnimation from 'react-animate-on-scroll';

import { BasicInfo, Project } from '@/types';
import { getAnimationProps } from '@/utils/accessibility';
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
      <Col key={project.title} className="projects__item my-3 px-3">
        <ScrollAnimation {...getAnimationProps('bounceInDown')}>
          <Card
            text={project.theme.text}
            className="projects__item__picture-card mx-auto"
            onClick={() => showDetailsModal(project)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showDetailsModal(project);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`View details for ${project.title} project`}
          >
            <Card.Body>
              <Stack gap={3} className="justify-content-between h-100">
                <Badge
                  text={project.theme.text}
                  className="projects__item__picture-card__date ms-auto"
                  aria-label={`Started in ${project.startDate}`}
                >
                  {project.startDate}
                </Badge>
                <Icon
                  icon={project.thumbnail}
                  className="projects__item__picture-card__thumbnail mx-auto"
                  aria-hidden="true"
                />

                <Card.Title as="h3" className="projects__item__picture-card__title font-trebuchet">
                  {project.title}
                </Card.Title>
              </Stack>
            </Card.Body>
          </Card>
        </ScrollAnimation>
      </Col>
    ));

  return (
    <section id="projects" className="projects" aria-labelledby="projects-heading">
      <Container>
        <Row>
          <Col md={12}>
            <h2 id="projects-heading" className="projects__heading">
              {headingText}
            </h2>
          </Col>
        </Row>
        <Row
          xs={1}
          sm={1}
          md={2}
          lg={2}
          xl={3}
          className="projects__list center"
          role="list"
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
