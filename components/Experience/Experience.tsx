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
  experience: IExperience;
}) => {
  const headingText = basicInfo.sectionName.experience;

  const experienceTimelineItems = experience.items.map((work, i) => (
    <TimelineItem {...work} key={i} />
  ));

  return (
    <section id="experience" className="experience" aria-labelledby="experience-heading">
      <Container>
        <Row>
          <Col md={12}>
            <h2 id="experience-heading" className="experience__title">
              {headingText}
            </h2>
          </Col>
        </Row>
        <Row>
          <Col md={12} className="mx-auto">
            <div aria-label="Work experience timeline">
              <VerticalTimeline className="timeline">
                {experienceTimelineItems}
                <VerticalTimelineElement
                  className="timeline__item start"
                  iconStyle={{
                    background: 'var(--icon-bg)',
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                    boxShadow:
                      '0 0 0 4px var(--line-color), inset 0 2px var(--line-color-inset-shadow), 0 3px 0 4px var(--line-color-inset-shadow-outer)',
                  }}
                  icon={
                    <Icon
                      icon={experience.done.icon}
                      className="timeline__item__icon"
                      aria-hidden="true"
                    />
                  }
                />
              </VerticalTimeline>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Experience;
