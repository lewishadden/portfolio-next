import Link from 'next/link';
import { Projects } from 'components/Projects/Projects';
import { getPageContent } from 'utils/serverUtils';
import { ResumeData } from '@/types';

export default async () => {
  const pageData: ResumeData = await getPageContent();

  return (
    <div className="section-page">
      <nav className="back-nav">
        <Link href="/" className="back-link">
          ← Back to Menu
        </Link>
      </nav>
      <Projects projects={pageData.projects} basicInfo={pageData.basicInfo} />
    </div>
  );
};
