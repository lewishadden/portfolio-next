import { Icon } from '@iconify/react';
import { Container, Row, Col } from 'react-bootstrap';

import { BasicInfo, Skills as ISkills } from '@/types';

import './Skills.scss';

export const Skills = ({ skills, basicInfo }: { skills: ISkills; basicInfo: BasicInfo }) => {
  const headingText = basicInfo.sectionName.skills;

  const skillTiles = skills?.icons?.map((skill, i) => (
    <Col xs="auto" key={i}>
      <div className="skills__list__tile">
        <Icon icon={skill.class} className="skills__list__tile__icon" />
        <p className="skills__list__tile__name m-0">{skill.name}</p>
      </div>
    </Col>
  ));

  return (
    <section id="skills" className="skills">
      <Container>
        <Row>
          <Col md={12}>
            <h2 className="skills__title">{headingText}</h2>
          </Col>
        </Row>
        <Row className="skills__list">{skillTiles}</Row>
      </Container>
    </section>
  );
};

export default Skills;
