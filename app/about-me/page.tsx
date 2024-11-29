import { Container, Center } from '@mantine/core';
import { PageHeader } from 'components/PageHeader/PageHeader';
import type { PageHeaderProps } from 'components/PageHeader/PageHeader';
import { About } from 'components/About/About';
import { getPageContent } from 'utils/serverUtils';
import { BasicInfo } from '@/types';

export default async () => {
  const pageData: BasicInfo = await getPageContent('basicInfo');

  const pageHeaderData: PageHeaderProps = {
    title: pageData.sectionName.about,
  };

  return (
    <Center>
      <Container size="xl" mx={{ base: 'sm', md: 'xl' }} py="lg">
        <PageHeader {...pageHeaderData} />
        <About basicInfo={pageData} />
      </Container>
    </Center>
  );
};
