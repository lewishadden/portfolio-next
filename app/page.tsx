import { Container } from '@mantine/core';
// import { PageHeader } from 'components/PageHeader/PageHeader';
// import type { PageHeaderProps } from 'components/PageHeader/PageHeader';
import { Home } from 'components/Home/Home';
import { getPageContent } from 'utils/serverUtils';
import { BasicInfo } from '@/types';

// const pageHeader: PageHeaderProps = {
//   title: 'UI Boilerplate',
//   description: 'Welcome To My Frontend Boilerplate',
// };

export default async () => {
  const pageData: BasicInfo = await getPageContent('basicInfo');

  return (
    <Container fluid mx={{ base: 'sm', md: 'xl' }} py="lg">
      {/* <PageHeader {...pageHeader} /> */}
      <Home basicInfo={pageData} />
    </Container>
  );
};
