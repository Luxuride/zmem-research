import * as fs from "node:fs";
import * as path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";
import type { NavGroup, PageEntry } from "./types.js";

export function computeRelativeHref(
  fromOutHtml: string,
  toOutHtml: string
): string {
  const fromDir = path.posix.dirname(fromOutHtml);
  const rel = path.posix.relative(fromDir, toOutHtml);
  return rel || path.posix.basename(toOutHtml);
}

export function mapRepoRelToOutHtml(repoRelPath: string): string {
  if (repoRelPath === "README.md") {
    return "index.html";
  }
  if (repoRelPath.startsWith("docs/")) {
    return repoRelPath.slice("docs/".length).replace(/\.md$/, ".html");
  }
  return repoRelPath.replace(/\.md$/, ".html");
}

function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".obsidian" ||
      entry.name === "templates"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results.sort();
}

export function discoverPages(
  repoRoot: string,
  docsRoot: string
): {
  pages: PageEntry[];
  lookup: Map<string, PageEntry>;
} {
  const mdFiles = [
    path.join(repoRoot, "README.md"),
    ...collectMarkdownFiles(docsRoot),
    ...collectMarkdownFiles(path.join(repoRoot, "citations")),
  ].filter((f) => fs.existsSync(f));

  const pages: PageEntry[] = [];
  const lookup = new Map<string, PageEntry>();

  for (const absPath of mdFiles) {
    const repoRelPath = path.relative(repoRoot, absPath).replace(/\\/g, "/");
    const isInsideDocs = repoRelPath.startsWith("docs/");
    const vaultRelPath = isInsideDocs
      ? path.relative(docsRoot, absPath).replace(/\\/g, "/")
      : repoRelPath;
    const outRelHtmlPath = mapRepoRelToOutHtml(repoRelPath);

    const raw = fs.readFileSync(absPath, "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);

    const entry: PageEntry = {
      absPath,
      repoRelPath,
      vaultRelPath,
      outRelHtmlPath,
      frontmatter,
      rawBody: body,
      headings: [],
    };
    pages.push(entry);

    const keysToRegister = [
      repoRelPath.toLowerCase(),
      repoRelPath.replace(/\.md$/, "").toLowerCase(),
      vaultRelPath.toLowerCase(),
      vaultRelPath.replace(/\.md$/, "").toLowerCase(),
      path.basename(repoRelPath, ".md").toLowerCase(),
      frontmatter.id.toLowerCase(),
      ...frontmatter.aliases.map((a) => a.toLowerCase()),
    ];
    for (const k of keysToRegister) {
      if (k && !lookup.has(k)) {
        lookup.set(k, entry);
      }
    }
  }

  return { pages, lookup };
}

export function buildNavigationGroups(pages: PageEntry[]): NavGroup[] {
  const filterBy = (predicate: (p: PageEntry) => boolean) =>
    pages.filter(predicate);

  const overviewItems = filterBy((p) =>
    [
      "README.md",
      "docs/INDEX.md",
      "docs/GLOSSARY.md",
      "docs/CHANGELOG.md",
    ].includes(p.repoRelPath)
  );
  const researchItems = filterBy((p) =>
    p.repoRelPath.startsWith("docs/research/")
  );
  const archItems = filterBy((p) =>
    p.repoRelPath.startsWith("docs/architecture/")
  );
  const adrItems = filterBy((p) => p.repoRelPath.startsWith("docs/adr/"));
  const expItems = filterBy((p) =>
    p.repoRelPath.startsWith("docs/experiments/")
  );
  const citationItems = filterBy((p) =>
    p.repoRelPath.startsWith("citations/")
  );

  return [
    {
      title: "Overview & Indexes",
      badge: String(overviewItems.length),
      items: overviewItems,
    },
    {
      title: "Research Chapters",
      badge: String(researchItems.length),
      items: researchItems,
    },
    {
      title: "Architecture Specs",
      badge: String(archItems.length),
      items: archItems,
    },
    {
      title: "ADR Decisions",
      badge: String(adrItems.length),
      items: adrItems,
    },
    {
      title: "Experiments",
      badge: String(expItems.length),
      items: expItems,
    },
    {
      title: "Citations & PDFs",
      badge: String(citationItems.length),
      items: citationItems,
    },
  ];
}
