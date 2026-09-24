import { PageNotFound } from 'components/PageNotFound/PageNotFound';

export default function NotFound() {
  return (
    <PageNotFound
      title="Lost in space"
      description="This page drifted out of orbit — the link may be broken, or the page has moved. Let’s get you back to base."
      cta={{
        text: 'Back to base',
      }}
    />
  );
}
