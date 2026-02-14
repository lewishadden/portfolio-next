'use client';

import { Icon } from '@iconify/react';

import TimelineItem from './TimelineItem/TimelineItem';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import { Experience as ExperienceProps } from '@/types';

import './Experience.scss';

export const Experience = ({ experience }: { experience: ExperienceProps }) => {
  const { title, label, items, done } = experience;

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

        <div
          className="timeline"
          role="list"
          aria-label="Work experience timeline"
        >
          <div className="timeline__line" aria-hidden="true" />

          {items.map((work, i) => (
            <TimelineItem {...work} index={i} key={i} />
          ))}

          {/* End marker */}
          <div className="timeline__item timeline__item--end" role="listitem">
            <ScrollReveal animation="fadeIn">
              <div className="timeline__item__icon-wrapper timeline__item__icon-wrapper--end">
                <Icon icon={done.icon} className="timeline__item__icon" aria-hidden="true" />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Experience;
