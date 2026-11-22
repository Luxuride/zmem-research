export interface Frontmatter {
  id: string;
  title: string;
  type: string;
  status: string;
  date: string;
  tags: string[];
  aliases: string[];
}

export interface TocHeading {
  level: number;
  text: string;
  slug: string;
}

export interface PageEntry {
  absPath: string;
  repoRelPath: string;
  vaultRelPath: string;
  outRelHtmlPath: string;
  frontmatter: Frontmatter;
  rawBody: string;
  headings: TocHeading[];
  htmlBody?: string;
}

export interface NavGroup {
  title: string;
  badge: string;
  items: PageEntry[];
}
