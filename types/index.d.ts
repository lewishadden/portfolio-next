export interface ResumeData {
  global: Global;
  header: Header;
  home: Home;
  about: About;
  experience: Experience;
  projects: Projects;
  skills: Skills;
  contact: Contact;
  footer: Footer;
}

export interface Global {
  openToWork: boolean;
  navItems: NavItem[];
}
export interface Header {
  home: {
    href: string;
    label: string;
    ariaLabel: string;
  };
  mobile: {
    icon: string;
  };
}

export interface Home {
  title: string;
  name: string;
  titles: string[];
  openToWorkText: string;
  tagline: string;
  cta: CtaPair;
}

export interface About {
  title: string;
  label: string;
  openToWorkText: string;
  descriptionHeader: string;
  description: string;
  image: {
    url: string;
    size: { width: number; height: number };
  };
  cv: {
    download: string;
  };
  cta: CtaPair;
}

export interface Experience {
  title: string;
  label: string;
  done: {
    icon: string;
  };
  items: ExperienceItem[];
}

export interface Projects {
  title: string;
  label: string;
  items: Project[];
  ctaText: string;
}

export interface Skills {
  title: string;
  label: string;
  icons: Icon[];
}

export interface Contact {
  title: string;
  label: string;
  tagline: string;
  contactInfo: {
    title: string;
    description: string;
    items: ContactInfo[];
  };
  send: {
    icon: string;
    text: string;
  };
  sendAgain: {
    icon: string;
    text: string;
  };
  submitting: {
    text: string;
  };
  error: {
    status: string;
    headerText: string;
    bodyText: string;
    icon: string;
  };
  success: {
    status: string;
    headerText: string;
    bodyText: string;
    icon: string;
  };
  close: {
    icon: string;
    ariaLabel: string;
  };
}

export interface Footer {
  name: string;
  tagline: string;
  social: Social[];
  home: {
    url: string;
    text: string;
    ariaLabel: string;
  };
  connectText: string;
  builtWith: {
    pretext: string;
    icon: string;
    posttext: string;
  };
}

export interface Social {
  name: string;
  url: string;
  class: string;
}

export interface ContactInfo {
  name: string;
  class: string;
  value: string;
  link: string;
}

export interface Project {
  title: string;
  startDate: string;
  description: string;
  theme: Theme;
  thumbnail: string;
  images: {
    url: string;
    alt?: string;
    size: { width: number; height: number };
  }[];
  url: string;
  technologies: Technology[];
}

export interface Theme {
  text: string;
  border: string;
  background: string;
}

export interface Technology {
  class: string;
  name: string;
}

export interface ExperienceItem {
  company: string;
  title: string;
  years: string;
  mainTech: string[];
  icon: string;
  technologies: string[];
}

export interface NavItem {
  href: string;
  label: string;
}

export interface Icon {
  name: string;
  class: string;
  level: string;
}

export interface CtaPair {
  primary: Cta;
  secondary: Cta;
}

export interface Cta {
  text: string;
  url: string;
  icon?: string;
  ariaLabel: string;
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?(...args: unknown[]): void;
  }
}
