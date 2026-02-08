'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';

import { BasicInfo } from '@/types';

import './Footer.scss';

export const Footer = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { social, name } = basicInfo;

  const networks = social.map((network) => (
    <li key={network.name} className="footer__social-links__item">
      <Link
        href={network.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${name}'s ${network.name} profile`}
        className="footer__social-links__link"
      >
        <Icon icon={network.class} className="footer__social-links__icon" aria-hidden="true" />
      </Link>
    </li>
  ));

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__content">
        <div className="footer__divider">
          <div className="footer__divider-line"></div>
        </div>

        <nav className="footer__social-links" aria-label="Social media links">
          <ul className="footer__social-links__list">{networks}</ul>
        </nav>

        <div className="footer__copyright">
          <p className="footer__copyright-text">
            © {new Date().getFullYear()} {name}. All rights reserved.
          </p>
          <p className="footer__built-with">
            Built with <Icon icon="mdi:heart" className="footer__heart-icon" aria-hidden="true" />{' '}
            using Next.js
          </p>
        </div>

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="footer__scroll-top"
          aria-label="Scroll to top"
          type="button"
        >
          <Icon icon="mdi:chevron-up" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
};

export default Footer;
