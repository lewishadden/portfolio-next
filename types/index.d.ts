export interface ResumeData {
  basicInfo: BasicInfo;
  projects: Project[];
  experience: Experience[];
  skills: Skills;
}

export interface BasicInfo {
  name: string;
  titles: string[];
  social: Social[];
  image: {
    url: string;
    size: { width: number; height: number };
  };
  descriptionHeader: string;
  description: string;
  sectionName: SectionName;
  contactInfo: ContactInfo[];
}

export interface Social {
  name: string;
  url: string;
  class: string;
}

export interface SectionName {
  about: string;
  projects: string;
  skills: string;
  experience: string;
  contact: string;
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
  images: [
    {
      url: string;
      size: { width: number; height: number };
    },
  ];
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

export interface Experience {
  company: string;
  title: string;
  years: string;
  mainTech: string[];
  icon: string;
  technologies: string[];
}

export interface Skills {
  icons: Icon[];
}

export interface Icon {
  name: string;
  class: string;
  level: string;
}
