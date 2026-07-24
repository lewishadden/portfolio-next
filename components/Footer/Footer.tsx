'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';

import { ArrowScribble } from 'components/Doodles/Doodles';

import { Footer as FooterProps, NavItem } from '@/types';

import './Footer.scss';

export const Footer = ({ footer, navItems }: { footer: FooterProps; navItems: NavItem[] }) => {
  const { tagline, social, name, home, connectText, builtWith, cta } = footer;

  return (
    <footer className="footer" role="contentinfo">
      {cta && (
        <div className="footer__cta">
          <Link href={cta.url} className="footer__cta-link">
            <span className="footer__cta-eyebrow">
              <span aria-hidden="true">( </span>
              {cta.pretext}
              <span aria-hidden="true"> )</span>
            </span>
            <span className="footer__cta-title">
              {cta.text} <em>{cta.accent}</em>
              <Icon icon="ph:arrow-up-right" className="footer__cta-arrow" aria-hidden="true" />
            </span>
          </Link>
          <ArrowScribble className="footer__cta-doodle" delay={0.4} />
        </div>
      )}

      <div className="footer__inner">
        <div className="footer__brand">
          <Link href={home.url} className="footer__logo" aria-label={home.ariaLabel}>
            <span>{home.text}</span>
            <span className="footer__logo-dot" aria-hidden="true">
              .
            </span>
          </Link>
          <p className="footer__tagline">{tagline}</p>
        </div>

        <nav aria-label="Footer navigation">
          <h5 className="footer__col-title">Navigate</h5>
          <ul className="footer__nav-list">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="footer__nav-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h5 className="footer__col-title">{connectText}</h5>
          <ul className="footer__social-list" aria-label="Social media links">
            {social.map((network) => (
              <li key={network.name}>
                <Link
                  href={network.url}
                  prefetch={false}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={network.name}
                  className="footer__social-link"
                >
                  <Icon icon={network.class} aria-hidden="true" />
                  <span>{network.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__bottom">
          <p className="footer__copy">
            &copy; {new Date().getFullYear()} {name}
          </p>
          <p className="footer__built">
            {builtWith.pretext}
            <Icon icon={builtWith.icon} className="footer__heart" aria-hidden="true" />
            {builtWith.posttext}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
