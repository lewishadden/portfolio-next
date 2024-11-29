import { readFile } from 'fs/promises';

const contentPath = './content/content.json';

export const getPageContent = async (sectionName: string) => {
  const content = await readFile(contentPath, 'utf-8');
  const parsedContent = JSON.parse(content);
  const sectionContent = parsedContent[sectionName];
  return sectionContent;
};
