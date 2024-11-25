import { Container } from '@mantine/core';
import { PageHeader } from 'components/PageHeader/PageHeader';
import type { PageHeaderProps } from 'components/PageHeader/PageHeader';

const pageHeader: PageHeaderProps = {
  title: 'UI Boilerplate',
  description: 'Welcome My Frontend Boilerplate',
};

export default async () => (
  <Container fluid mx={{ base: 'sm', md: 'xl' }} py="lg">
    <PageHeader {...pageHeader} />
    {/* Add Content Here */}
  </Container>
);
