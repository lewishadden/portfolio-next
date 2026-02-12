import { PageNotFound } from 'components/PageNotFound/PageNotFound';

export default async function NotFound() {
  return (
    <PageNotFound
      title="Nothing to see here"
      description="The page you are trying to open does not exist. You may have mistyped the address, or the page has been moved to another URL. If you think this is an error contact support."
      cta={{
        text: 'Back to home page',
      }}
    />
  );
}
