'use client';

import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import { Icon } from '@iconify/react';
import { Container, Row, Col } from 'react-bootstrap';
import { BasicInfo, Experience as IExperience } from '@/types';

import TimelineItem from './TimelineItem/TimelineItem';

import './Experience.scss';

export const Experience = ({
  basicInfo,
  experience,
}: {
  basicInfo: BasicInfo;
  experience: IExperience[];
}) => {
  const headingText = basicInfo.sectionName.experience;

  const experienceTimelineItems = experience.map((work, i) => <TimelineItem {...work} key={i} />);

  return (
    <section id="experience" className="experience">
      <Container>
        <Row>
          <Col md={12}>
            <h2 className="experience__title">{headingText}</h2>
          </Col>
        </Row>
        <Row>
          <Col md={12} className="mx-auto">
            <VerticalTimeline className="timeline">
              {experienceTimelineItems}
              <VerticalTimelineElement
                className="timeline__item start"
                iconStyle={{
                  background: 'rgb(63 63 63)',
                  color: '#fff',
                  textAlign: 'center',
                }}
                icon={<Icon icon="twemoji:hourglass-done" className="timeline__item__icon" />}
              />
            </VerticalTimeline>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Experience;
