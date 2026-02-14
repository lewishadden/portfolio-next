import { Icon } from '@iconify/react';

import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import { ExperienceItem } from '@/types';

import './TimelineItem.scss';

const staggerDelay = 0.15;

const TimelineItem = ({
  technologies,
  mainTech,
  title,
  company,
  years,
  icon,
  index,
}: ExperienceItem & { index: number }) => {
  return (
    <div className="timeline__item" role="listitem">
      {/* Icon dot on the timeline line — outside ScrollReveal so position: absolute anchors to the timeline item, not the animated wrapper */}
      <div className="timeline__item__icon-wrapper" aria-hidden="true">
        <Icon icon={icon} className="timeline__item__icon" />
      </div>

      <ScrollReveal
        animation="fadeInUp"
        delay={index * staggerDelay}
        className="timeline__item__inner"
      >
        {/* Content card */}
        <div className="timeline__item__card">
          <div className="timeline__item__arrow" aria-hidden="true" />

          <div className="timeline__item__header">
            <div>
              <h3 className="timeline__item__title">{title}</h3>
              <h4 className="timeline__item__subtitle">{company}</h4>
            </div>
            <time className="timeline__item__date">{years}</time>
          </div>

          <div className="timeline__item__main-badges">
            {mainTech.map((technology, i) => (
              <span
                className="timeline__item__badge timeline__item__badge--main font-trebuchet"
                key={i}
              >
                {technology}
              </span>
            ))}
          </div>

          <div className="timeline__item__extra-badges">
            {technologies.map((technology, i) => (
              <span
                className="timeline__item__badge timeline__item__badge--extra font-trebuchet"
                key={i}
              >
                {technology}
              </span>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
};

export default TimelineItem;
