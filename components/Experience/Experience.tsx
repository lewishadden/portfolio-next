'use client';

import { VerticalTimeline, VerticalTimelineElement } from 'react-vertical-timeline-component';
import { Icon } from '@iconify/react';

import TimelineItem from './TimelineItem/TimelineItem';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import { Experience as ExperienceProps } from '@/types';

import 'react-vertical-timeline-component/style.min.css';
import './Experience.scss';

export const Experience = ({ experience }: { experience: ExperienceProps }) => {
  const { title, label, items, done } = experience;

  const experienceTimelineItems = items.map((work, i) => <TimelineItem {...work} key={i} />);

  return (
    <section id="experience" className="experience" aria-labelledby="experience-heading">
      <div className="experience__container">
        <div className="experience__heading-wrapper">
          <ScrollReveal animation="slideUp">
            <span className="experience__label">{label}</span>
          </ScrollReveal>
          <ScrollReveal animation="slideUp" delay={0.1}>
            <h2 id="experience-heading" className="experience__title">
              {title}
            </h2>
          </ScrollReveal>
        </div>

        <div role="group" aria-label="Work experience timeline">
          <VerticalTimeline className="timeline" lineColor="var(--border-color)">
            {experienceTimelineItems}
            <VerticalTimelineElement
              className="timeline__item timeline__item--end"
              iconStyle={{
                background:
                  'linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-mid) 50%, var(--gradient-end) 100%)',
                color: '#ffffff',
                boxShadow: '0 0 0 4px var(--bg-primary), 0 4px 12px rgba(0, 0, 0, 0.12)',
              }}
              icon={<Icon icon={done.icon} className="timeline__item__icon" aria-hidden="true" />}
            />
          </VerticalTimeline>
        </div>
      </div>
    </section>
  );
};

export default Experience;
