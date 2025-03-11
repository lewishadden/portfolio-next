import { Home } from 'components/Home/Home';
import { getPageContent } from 'utils/serverUtils';
import { ResumeData } from '@/types';
import Link from 'next/link';

export default async () => {
  const pageData: ResumeData = await getPageContent();

  return (
    <div className="section-page">
      <nav className="back-nav">
        <Link href="/" className="back-link">
          ← Back to Menu
        </Link>
      </nav>
      <Home basicInfo={pageData.basicInfo} />
    </div>
  );
};
