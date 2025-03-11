import Link from 'next/link';
import { Skills } from 'components/Skills/Skills';
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
      <Skills skills={pageData.skills} basicInfo={pageData.basicInfo} />
    </div>
  );
};
