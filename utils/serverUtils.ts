import { readFile } from 'fs/promises';

const contentPath = './content/content.json';

export const getPageContent = async (sectionName?: string) => {
  const content = await readFile(contentPath, 'utf-8');
  let parsedContent = JSON.parse(content);
  if (sectionName) parsedContent = parsedContent[sectionName];
  return parsedContent;
};
