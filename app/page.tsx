import Link from 'next/link';
import { getPageContent } from 'utils/serverUtils';
import { ResumeData } from '@/types';
import './page.scss';

export default async () => {
  const pageData: ResumeData = await getPageContent();

  return (
    <div className="landing-container">
      <h1>{pageData.basicInfo.name}'s Portfolio</h1>
      <nav className="section-navigation">
        <Link href="/home" className="nav-link">
          Home
        </Link>
        <Link href="/about" className="nav-link">
          About
        </Link>
        <Link href="/experience" className="nav-link">
          Experience
        </Link>
        <Link href="/projects" className="nav-link">
          Projects
        </Link>
        <Link href="/skills" className="nav-link">
          Skills
        </Link>
        <Link href="/contact" className="nav-link">
          Contact
        </Link>
      </nav>
    </div>
  );
};
