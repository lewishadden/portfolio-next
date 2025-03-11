import Link from 'next/link';
import { Experience } from 'components/Experience/Experience';
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
      <Experience experience={pageData.experience} basicInfo={pageData.basicInfo} />
    </div>
  );
};
