'use client';

import { Icon } from '@iconify/react';
import { Container, Row, Col } from 'react-bootstrap';
import ScrollAnimation from 'react-animate-on-scroll';

import { BasicInfo, Skills as ISkills } from '@/types';
import { getAnimationProps } from '@/utils/accessibility';

import './Skills.scss';

export const Skills = ({ skills, basicInfo }: { skills: ISkills; basicInfo: BasicInfo }) => {
  const headingText = basicInfo.sectionName.skills;

  const skillTiles = skills?.icons?.map((skill, i) => (
    <Col xs="auto" key={i}>
      <ScrollAnimation {...getAnimationProps('flipInX')} duration={2}>
        <div className="skills__list__tile" role="listitem">
          <Icon icon={skill.class} className="skills__list__tile__icon" aria-hidden="true" />
          <p className="skills__list__tile__name m-0">{skill.name}</p>
        </div>
      </ScrollAnimation>
    </Col>
  ));

  return (
    <section id="skills" className="skills" aria-labelledby="skills-heading">
      <Container>
        <Row>
          <Col md={12}>
            <h2 id="skills-heading" className="skills__title">
              {headingText}
            </h2>
          </Col>
        </Row>
        <Row className="skills__list" role="list" aria-label="Technical skills">
          {skillTiles}
        </Row>
      </Container>
    </section>
  );
};

export default Skills;
