'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';

import { Footer as FooterProps, NavItem } from '@/types';

import './Footer.scss';

export const Footer = ({ footer, navItems }: { footer: FooterProps; navItems: NavItem[] }) => {
  const { tagline, social, name, home, connectText, builtWith } = footer;

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">
        <div className="footer__main">
          <div className="footer__brand">
            <a
              href={home.url}
              className="footer__logo"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label={home.ariaLabel}
            >
              {home.text}
            </a>
            <p className="footer__tagline">{tagline}</p>
          </div>

          <nav className="footer__nav" aria-label="Footer navigation">
            <ul className="footer__nav-list">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="footer__nav-link">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer__connect">
            <span className="footer__connect-label">{connectText}</span>
            <ul className="footer__social-list" aria-label="Social media links">
              {social.map((network) => (
                <li key={network.name}>
                  <Link
                    href={network.url}
                    as={'a'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${network.name}`}
                    className="footer__social-link"
                  >
                    <Icon icon={network.class} aria-hidden="true" />
                    <span>{network.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer__divider" />

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
