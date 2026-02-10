'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';

import { BasicInfo } from '@/types';

import './Footer.scss';

const FOOTER_NAV = [
  { href: '#about', label: 'About' },
  { href: '#experience', label: 'Experience' },
  { href: '#projects', label: 'Projects' },
  { href: '#skills', label: 'Skills' },
  { href: '#contact', label: 'Contact' },
];

export const Footer = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { social, name } = basicInfo;

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner">
        <div className="footer__main">
          <div className="footer__brand">
            <a
              href="#home"
              className="footer__logo"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label="Back to top"
            >
              LH
            </a>
            <p className="footer__tagline">
              Senior Full Stack Engineer crafting modern web experiences.
            </p>
          </div>

          <nav className="footer__nav" aria-label="Footer navigation">
            <ul className="footer__nav-list">
              {FOOTER_NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="footer__nav-link">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer__connect">
            <span className="footer__connect-label">Connect</span>
            <ul className="footer__social-list" aria-label="Social media links">
              {social.map((network) => (
                <li key={network.name}>
                  <Link
                    href={network.url}
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
            Built with <Icon icon="mdi:heart" className="footer__heart" aria-hidden="true" /> &amp;
            Next.js
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
