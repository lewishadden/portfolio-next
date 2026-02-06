import { Icon } from '@iconify/react';
import Link from 'next/link';

import { BasicInfo } from '@/types';

import './Footer.scss';

export const Footer = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { social, name } = basicInfo;

  const networks = social.map((network) => (
    <li key={network.name} className="m-4">
      <Link
        href={network.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${name}'s ${network.name} profile`}
      >
        <Icon icon={network.class} style={{ fontSize: '3rem' }} aria-hidden="true" />
      </Link>
    </li>
  ));

  return (
    <footer className="footer" role="contentinfo">
      <div className="col-md-12">
        <nav className="footer__social-links" aria-label="Social media links">
          <ul className="list-unstyled d-flex justify-content-center flex-wrap m-0">{networks}</ul>
        </nav>
        <div className="py-4">
          <small>
            Copyright &copy; {new Date().getFullYear()} {name}. All rights reserved.
          </small>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
