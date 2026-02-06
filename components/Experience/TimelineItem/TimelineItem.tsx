import { VerticalTimelineElement } from 'react-vertical-timeline-component';
import Badge from 'react-bootstrap/Badge';
import { Icon } from '@iconify/react';
import { ExperienceItem } from '@/types';

import './TimelineItem.scss';

const TimelineItem = ({ technologies, mainTech, title, company, years, icon }: ExperienceItem) => {
  const MainTechBadges = () => (
    <div className="timeline__item__main-badge-container">
      {mainTech.map((technology, i) => (
        <Badge className="timeline__item__badge main font-trebuchet me-2 mb-2" key={i}>
          {technology}
        </Badge>
      ))}
    </div>
  );

  const ExtraTechBadges = () => (
    <div className="timeline__item__extra-badge-container">
      {technologies.map((technology, i) => (
        <Badge className="timeline__item__badge extra font-trebuchet me-2 mb-2" key={i}>
          {technology}
        </Badge>
      ))}
    </div>
  );

  return (
    <VerticalTimelineElement
      className="timeline__item"
      date={years}
      iconStyle={{
        background: 'var(--icon-bg)',
        color: 'var(--text-primary)',
        boxShadow:
          '0 0 0 4px var(--line-color), inset 0 2px var(--line-color-inset-shadow), 0 3px 0 4px var(--line-color-inset-shadow-outer)',
      }}
      icon={<Icon icon={icon} className="timeline__item__icon" />}
    >
      <MainTechBadges />
      <h3 className="vertical-timeline-element-title">{title}</h3>
      <h4 className="vertical-timeline-element-subtitle timeline__item__subtitle">{company}</h4>
      <ExtraTechBadges />
    </VerticalTimelineElement>
  );
};

export default TimelineItem;
