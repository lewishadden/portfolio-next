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
            <div className="experience__heading-wrapper">
              <h2 id="experience-heading" className="experience__title">
                {headingText}
              </h2>
              <div className="experience__heading-underline"></div>
            </div>
          </Col>
        </Row>
        <Row>
          <Col md={12} className="mx-auto">
            <div aria-label="Work experience timeline">
              <VerticalTimeline className="timeline" lineColor="var(--border-color)">
                {experienceTimelineItems}
                <VerticalTimelineElement
                  className="timeline__item timeline__item--end"
                  iconStyle={{
                    background: 'linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-mid) 50%, var(--gradient-end) 100%)',
                    color: '#ffffff',
                    textAlign: 'center',
                    boxShadow: '0 0 0 4px var(--bg-primary), 0 8px 16px rgba(0, 0, 0, 0.15)',
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
