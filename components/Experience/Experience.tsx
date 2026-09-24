'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { m, useInView, useScroll, useTransform } from 'framer-motion';

import Magnet from 'components/Magnet/Magnet';
import { PageHead } from 'components/PageHead/PageHead';
import { illustrations } from 'components/World/StationFallback';
import { Reveal } from 'components/Motion/Reveal';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import { companyInitials, firstYear, formatRange, roleDuration } from './timeline';

import type { Variants } from 'framer-motion';
import type { Experience as ExperienceProps, ExperienceItem } from '@/types';

import './Experience.scss';

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * The rail's glowing edge tracks a line 62% down the viewport; a node lights
 * once its item crosses that same line. The in-view root is stretched a full
 * screen upwards so nodes stay lit after they scroll off the top.
 */
const railOffset: ['start 62%', 'end 62%'] = ['start 62%', 'end 62%'];
const litMargin = '100% 0px -38% 0px';

const nodeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.3 },
  shown: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 18 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, x: 64, filter: 'blur(14px)' },
  shown: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 1, ease, staggerChildren: 0.07, delayChildren: 0.15 },
  },
};

const partVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

const chipListVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.05 } },
};

const chipVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.7 },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 420, damping: 24 },
  },
};

const TimelineItem = ({ item, number }: { item: ExperienceItem; number: string }) => {
  const itemRef = useRef<HTMLLIElement>(null);
  const lit = useInView(itemRef, { margin: litMargin });
  const glowRef = usePointerGlow<HTMLElement>({ tilt: 2.5 });
  const duration = roleDuration(item.years);

  return (
    <m.li
      ref={itemRef}
      className={`xp__item${lit ? ' xp__item--lit' : ''}`}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      <m.div className="xp__node" variants={nodeVariants} aria-hidden="true">
        <span className="xp__node-orbit">
          <span className="xp__node-sat" />
        </span>
        <span className="xp__node-core">{companyInitials(item.company)}</span>
      </m.div>

      <m.div className="xp__card-wrap" variants={cardVariants}>
        <article className="xp__card glass spotlight" ref={glowRef}>
          <span className="xp__num" aria-hidden="true">
            {number}
          </span>

          <m.p className="xp__meta" variants={partVariants}>
            <span className="chip xp__date">
              <Icon icon="ph:calendar-dots-bold" width={13} height={13} aria-hidden="true" />
              {formatRange(item.years)}
            </span>
            {duration && (
              <span className="xp__duration">
                <span aria-hidden="true">{duration.short}</span>
                <span className="sr-only">, {duration.long}</span>
              </span>
            )}
          </m.p>

          <m.h2 className="xp__role" variants={partVariants}>
            {item.title}
          </m.h2>

          <m.p className="xp__company" variants={partVariants}>
            <Icon icon="ph:buildings-bold" width={16} height={16} aria-hidden="true" />
            {item.company}
          </m.p>

          {item.description && (
            <m.p className="xp__desc" variants={partVariants}>
              {item.description}
            </m.p>
          )}

          <m.ul className="xp__stack" variants={chipListVariants} aria-label="Core stack">
            {item.mainTech.map((tech) => (
              <m.li key={tech} className="chip xp__chip" variants={chipVariants}>
                {tech}
              </m.li>
            ))}
          </m.ul>

          {item.technologies.length > 0 && (
            <m.div className="xp__also" variants={partVariants}>
              <span className="xp__also-label" aria-hidden="true">
                <Icon icon="ph:plus-bold" width={10} height={10} />
                Also
              </span>
              <ul className="xp__also-list" aria-label="Also used">
                {item.technologies.map((tech) => (
                  <li key={tech} className="chip xp__chip xp__chip--minor">
                    {tech}
                  </li>
                ))}
              </ul>
            </m.div>
          )}
        </article>
      </m.div>
    </m.li>
  );
};

export const Experience = ({ experience }: { experience: ExperienceProps }) => {
  const { label, items } = experience;
  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: timelineRef, offset: railOffset });
  const cometTop = useTransform(scrollYProgress, (v) => `${v * 100}%`);
  const cometOpacity = useTransform(scrollYProgress, [0, 0.015, 0.985, 1], [0, 1, 1, 0]);

  const since = firstYear(items) ?? 2018;
  const companyCount = new Set(items.map((item) => item.company)).size;

  return (
    <section id="experience" className="page xp" aria-labelledby="experience-heading">
      <PageHead
        id="experience-heading"
        index="02"
        label={label}
        title="Work"
        accent="experience"
        illustration={illustrations.satellite}
        sub="Almost a decade across IBM, Sopra Steria, ERGO Travel and ADP — frontend, full stack and cloud architecture."
      >
        <Reveal as="ul" className="xp__stats" delay={0.24} aria-label="At a glance">
          <li className="xp__stat">
            <b>{String(items.length).padStart(2, '0')}</b> roles
          </li>
          <li className="xp__stat">
            <b>{String(companyCount).padStart(2, '0')}</b> companies
          </li>
          <li className="xp__stat">
            since <b>{since}</b>
          </li>
        </Reveal>
      </PageHead>

      <div className="xp__timeline" ref={timelineRef}>
        <div className="xp__rail" aria-hidden="true">
          <m.div className="xp__rail-fill" style={{ scaleY: scrollYProgress }} />
          <m.div className="xp__rail-comet" style={{ top: cometTop, opacity: cometOpacity }} />
        </div>

        <ol className="xp__list">
          {items.map((item, i) => (
            <TimelineItem
              key={`${item.company}-${item.years}`}
              item={item}
              number={String(items.length - i).padStart(2, '0')}
            />
          ))}
        </ol>

        <Reveal className="xp__end" y={20}>
          <span className="xp__end-node" aria-hidden="true" />
          <p className="xp__end-text">
            Launched <b>{since}</b> <span aria-hidden="true">—</span> still shipping
          </p>
        </Reveal>
      </div>

      <Reveal as="div" className="page-nav">
        <Magnet>
          <Link href="/projects" className="btn btn--primary">
            <Icon icon="ph:cube-focus-bold" width={18} height={18} aria-hidden="true" />
            <span>See projects</span>
            <Icon icon="ph:arrow-right-bold" width={16} height={16} aria-hidden="true" />
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/contact" className="btn btn--ghost">
            <Icon icon="ph:paper-plane-tilt-bold" width={18} height={18} aria-hidden="true" />
            <span>Work together</span>
          </Link>
        </Magnet>
      </Reveal>
    </section>
  );
};

export default Experience;
