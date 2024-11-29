import { Icon } from '@iconify/react';
import Link from 'next/link';

import { BasicInfo } from '@/types';

import './Footer.scss';

export const Footer = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { social, name } = basicInfo;

  const networks = social.map((network) => (
    <span key={network.name} className="m-4">
      <Link
        href={network.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View my ${network.name} profile.`}
      >
        <Icon icon={network.class} style={{ fontSize: '3rem' }} />
      </Link>
    </span>
  ));

  return (
    <footer className="footer">
      <div className="col-md-12">
        <div className="footer__social-links">{networks}</div>
        <div className="py-4">
          <small>Copyright &copy; {name}</small>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
