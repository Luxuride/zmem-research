#!/usr/bin/env node
/**
 * Static Site Generator CLI Entry Point for zmem-research
 *
 * Orchestrates:
 * 1. Markdown document discovery & frontmatter parsing (scripts/site/discovery.ts)
 * 2. Obsidian [[wikilink]], [@citekey], alert, and assumption rendering (scripts/site/markdown.ts)
 * 3. Preact SSR component tree rendering (scripts/site/components/*)
 * 4. Tailwind CSS compilation via PostCSS (scripts/site/tailwind.ts)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { render } from "preact-render-to-string";
import { PageLayout } from "./site/components/PageLayout.js";
import {
  buildNavigationGroups,
  computeRelativeHref,
  discoverPages,
} from "./site/discovery.js";
import { renderPageMarkdown } from "./site/markdown.js";
import { compileTailwindCss } from "./site/tailwind.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");
const DIST_ROOT = path.join(REPO_ROOT, "dist");

function copyDirRecursive(srcDir: string, dstDir: string): void {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

async function main(): Promise<void> {
  fs.rmSync(DIST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DIST_ROOT, { recursive: true });

  // 1. Discover pages and build collapsible sidebar groups
  const { pages, lookup } = discoverPages(REPO_ROOT, DOCS_ROOT);
  const navGroups = buildNavigationGroups(pages);
  const orderedPages = navGroups.flatMap((g) => g.items);

  // 2. Render Markdown bodies and extract headings
  for (const page of orderedPages) {
    const { html, headings } = renderPageMarkdown(page, lookup);
    page.htmlBody = html;
    page.headings = headings;
  }

  // 3. Render Preact SSR layout for each page
  for (let idx = 0; idx < orderedPages.length; idx++) {
    const page = orderedPages[idx];
    const prevPage = idx > 0 ? orderedPages[idx - 1] : undefined;
    const nextPage =
      idx + 1 < orderedPages.length ? orderedPages[idx + 1] : undefined;

    const cssHref = computeRelativeHref(
      page.outRelHtmlPath,
      "assets/style.css"
    );
    const homeHref = computeRelativeHref(page.outRelHtmlPath, "index.html");

    const vnode = PageLayout({
      page,
      navGroups,
      prevPage,
      nextPage,
      cssHref,
      homeHref,
    });
    const fullHtml = "<!DOCTYPE html>\n" + render(vnode);

    const outAbsPath = path.join(DIST_ROOT, page.outRelHtmlPath);
    fs.mkdirSync(path.dirname(outAbsPath), { recursive: true });
    fs.writeFileSync(outAbsPath, fullHtml, "utf8");
  }

  // 4. Copy citation PDFs, reference HTML, and BibTeX database
  copyDirRecursive(
    path.join(REPO_ROOT, "citations", "pdfs"),
    path.join(DIST_ROOT, "citations", "pdfs")
  );
  copyDirRecursive(
    path.join(REPO_ROOT, "citations", "html"),
    path.join(DIST_ROOT, "citations", "html")
  );
  const bibSrc = path.join(REPO_ROOT, "citations", "references.bib");
  if (fs.existsSync(bibSrc)) {
    fs.copyFileSync(
      bibSrc,
      path.join(DIST_ROOT, "citations", "references.bib")
    );
  }

  // 5. Compile Tailwind CSS stylesheet and write .nojekyll
  const css = await compileTailwindCss(REPO_ROOT, DIST_ROOT);
  const assetsDir = path.join(DIST_ROOT, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, "style.css"), css, "utf8");
  fs.writeFileSync(path.join(DIST_ROOT, ".nojekyll"), "", "utf8");

  console.log(
    `✅ Built static Preact + Tailwind site in dist/ (${orderedPages.length} HTML pages, assets/style.css, and citations/pdfs + citations/html assets).`
  );
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
