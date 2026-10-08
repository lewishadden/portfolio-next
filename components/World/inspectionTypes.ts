import type { StationKey } from './routes';
import type { Contact, Recommendation } from '@/types';

/** Stable across timeline reordering; dates and array positions are not identities. */
export const getRoleId = (company: string, title: string) =>
  `${company}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export interface InspectionSelection {
  kind: 'project' | 'skill' | 'role' | 'station';
  id: string;
  station: StationKey;
  anchor?: [number, number, number];
}

export interface InspectionProject {
  id: string;
  title: string;
  href: string;
  url: string;
  description: string;
  problem: string;
  contribution: string;
  result: string;
  technologies: string[];
  images: { url: string; alt: string; width: number; height: number; fullPage: boolean }[];
  steps: { title: string; text: string }[];
  demonstration?: 'citations' | 'modules' | 'pipeline' | 'architecture';
}

export interface InspectionRole {
  id: string;
  title: string;
  company: string;
  years: string;
  description: string;
  technologies: string[];
  projects: string[];
}

export interface InspectionSkill {
  id: string;
  name: string;
  category: string;
  projects: string[];
  roles: string[];
}

export interface InspectionCatalog {
  projects: InspectionProject[];
  roles: InspectionRole[];
  skills: InspectionSkill[];
  contact: Contact;
  destinations: { href: string; title: string; text: string }[];
  about: {
    name: string;
    description: string;
    portrait: string;
    highlights: { title: string; sub: string }[];
    recommendations: Recommendation[];
    cv: { url: string; name: string };
  };
}
