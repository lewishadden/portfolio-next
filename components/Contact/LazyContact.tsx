'use client';

import dynamic from 'next/dynamic';
import { BasicInfo, Contact as ContactType } from '@/types';

const Contact = dynamic(() => import('./Contact').then((m) => m.Contact), {
  ssr: false,
});

export function LazyContact({
  basicInfo,
  contact,
}: {
  basicInfo: BasicInfo;
  contact: ContactType;
}) {
  return <Contact basicInfo={basicInfo} contact={contact} />;
}
