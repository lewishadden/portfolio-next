'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandMark } from 'components/BrandMark/BrandMark';
import Magnet from 'components/Magnet/Magnet';
import { Reveal } from 'components/Motion/Reveal';
import { ScrambleText } from 'components/Motion/ScrambleText';
import { rangeBetween, stationForPath, stationNames } from 'components/World/routes';

import { MotionControl } from './MotionControl';

import { Footer as FooterProps, NavItem } from '@/types';

import './Footer.scss';

/**
 * The site's footer: a call to action, then a console (while the header is
 * a HUD it takes the HUD's look: an opaque panel with a hairline frame and
 * corner brackets) with the brand mark, the nav as a station manifest (each
 * page's number, matching its eyebrow, its craft and its range from here),
 * the social links and the visitor's settings. Server-rendered, the current
 * page included
 */
export const Footer = ({ footer, navItems }: { footer: FooterProps; navItems: NavItem[] }) => {
  const { tagline, social, name, home, connectText, navigateText, builtWith, cta, version } =
    footer;
  const pathname = usePathname();
  const here = stationForPath(pathname);
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <footer className="footer">
      {cta && (
        <Reveal className="footer__cta">
          <p className="footer__cta-eyebrow">
            <span className="footer__cta-line" aria-hidden="true" />
            <ScrambleText text={cta.pretext} />
          </p>
          <Link href={cta.url} className="footer__cta-link">
            <span className="footer__cta-title">
              {cta.text} <span className="text-gradient">{cta.accent}</span>
            </span>
            <span className="footer__cta-orb" aria-hidden="true">
              <span className="footer__cta-orb-ring" />
              <Icon icon="ph:arrow-up-right-bold" className="footer__cta-arrow" />
            </span>
          </Link>
        </Reveal>
      )}

      <div className="footer__inner">
        <div className="footer__brand">
          <Link href={home.url} className="footer__logo" aria-label={home.ariaLabel}>
            <BrandMark className="footer__mark" />
          </Link>
          <p className="footer__tagline">{tagline}</p>
        </div>

        <nav aria-label="Footer navigation" className="footer__col">
          <h2 className="footer__col-title">{navigateText}</h2>
          <ul className="footer__nav-list">
            {navItems.map((item, i) => {
              const station = stationForPath(item.href);
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`footer__nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="footer__nav-index" aria-hidden="true">
                      {String(i).padStart(2, '0')}
                    </span>
                    <span className="footer__nav-label">
                      <ScrambleText text={item.label} hover trigger="none" duration={400} />
                    </span>
                    <span className="footer__nav-craft" aria-hidden="true">
                      {stationNames[station].craft}
                    </span>
                    <span className="footer__nav-range" aria-hidden="true">
                      {active ? 'Docked' : `${rangeBetween(here, station)} km`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="footer__col">
          <h2 className="footer__col-title">{connectText}</h2>
          <ul className="footer__social-list">
            {social.map((network) => (
              <li key={network.name}>
                <Magnet strength={0.25}>
                  <Link
                    href={network.url}
                    prefetch={false}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer__social-link"
                  >
                    <Icon icon={network.class} aria-hidden="true" />
                    <span>{network.name}</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </Magnet>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__col footer__console">
          <MotionControl />
        </div>
      </div>

      <div className="footer__bottom">
        <p className="footer__copy">
          &copy; {new Date().getFullYear()} {name}
          <span className="footer__version">{version}</span>
        </p>
        <p className="footer__built">
          {builtWith.pretext}
          <Icon icon={builtWith.icon} className="footer__heart" aria-hidden="true" />
          <span className="sr-only">love</span>
          {builtWith.posttext}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
