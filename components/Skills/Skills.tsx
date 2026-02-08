'use client';

import { Icon } from '@iconify/react';
import { Container, Row, Col } from 'react-bootstrap';

import { BasicInfo, Skills as ISkills } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import './Skills.scss';

export const Skills = ({ skills, basicInfo }: { skills: ISkills; basicInfo: BasicInfo }) => {
  const headingText = basicInfo.sectionName.skills;

  const skillTiles = skills?.icons?.map((skill, i) => (
    <Col as="li" xs="auto" key={i}>
      <ScrollReveal animation="flipInX">
        <div className="skills__list__tile">
          <div className="skills__list__tile__icon-wrapper">
            <Icon icon={skill.class} className="skills__list__tile__icon" aria-hidden="true" />
            <div className="skills__list__tile__icon-glow"></div>
          </div>
          <p className="skills__list__tile__name">{skill.name}</p>
        </div>
      </ScrollReveal>
    </Col>
  ));

  return (
    <section id="skills" className="skills" aria-labelledby="skills-heading">
      <Container>
        <Row>
          <Col md={12}>
            <div className="skills__heading-wrapper">
              <h2 id="skills-heading" className="skills__title">
                {headingText}
              </h2>
              <div className="skills__heading-underline"></div>
            </div>
          </Col>
        </Row>
        <Row as="ul" className="skills__list list-unstyled" aria-label="Technical skills">
          {skillTiles}
        </Row>
      </Container>
    </section>
  );
};

export default Skills;
