import type { Frontmatter } from "./types.js";

const DEFAULT_FRONTMATTER: Frontmatter = {
  id: "DOC",
  title: "Document",
  type: "doc",
  status: "active",
  date: "2026-11-21",
  tags: [],
  aliases: [],
};

export function parseFrontmatter(raw: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const endMatch = raw.match(/\r?\n---\r?\n/);
  if (
    (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) ||
    !endMatch ||
    endMatch.index === undefined
  ) {
    return { frontmatter: { ...DEFAULT_FRONTMATTER }, body: raw };
  }

  const yamlText = raw.slice(4, endMatch.index);
  const body = raw.slice(endMatch.index + endMatch[0].length);
  const fm: Record<string, unknown> = {};
  const lines = yamlText.split(/\r?\n/);

  let currentListKey: string | null = null;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listMatch = line.match(/^\s+-\s+(.*)$/);
    if (listMatch && currentListKey) {
      const val = listMatch[1].trim().replace(/^["']|["']$/g, "");
      const arr = fm[currentListKey];
      if (Array.isArray(arr)) {
        arr.push(val);
      } else {
        fm[currentListKey] = [val];
      }
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1];
    const rawVal = kvMatch[2].trim();
    if (rawVal === "") {
      fm[key] = [];
      currentListKey = key;
    } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      currentListKey = null;
      const inner = rawVal.slice(1, -1).trim();
      fm[key] = inner
        ? inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
        : [];
    } else {
      currentListKey = null;
      fm[key] = rawVal.replace(/^["']|["']$/g, "");
    }
  }

  return {
    frontmatter: {
      id: typeof fm.id === "string" ? fm.id : DEFAULT_FRONTMATTER.id,
      title:
        typeof fm.title === "string" ? fm.title : DEFAULT_FRONTMATTER.title,
      type: typeof fm.type === "string" ? fm.type : DEFAULT_FRONTMATTER.type,
      status:
        typeof fm.status === "string" ? fm.status : DEFAULT_FRONTMATTER.status,
      date: typeof fm.date === "string" ? fm.date : DEFAULT_FRONTMATTER.date,
      tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
      aliases: Array.isArray(fm.aliases) ? (fm.aliases as string[]) : [],
    },
    body,
  };
}
