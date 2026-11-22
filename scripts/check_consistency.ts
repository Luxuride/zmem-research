#!/usr/bin/env node
/**
 * Repository Consistency Validator for zmem-research (TypeScript / tsx)
 *
 * Enforces across docs/ (and root README.md):
 * 1. Obsidian [[wikilink]] integrity (file resolution via vault-relative path, repo-relative path, basename, id, or alias + optional #heading verification).
 * 2. Citation [@citekey] integrity against BOTH docs/citations/references.bib and docs/citations/sources.md.
 * 3. YAML frontmatter schema (id, title, type, status, date, tags, aliases) and required epistemic/ADR sections:
 *    - docs/research/*.md: ## Assumptions, ## What Was Tried, ## Conclusions, ## Revision Log
 *    - docs/experiments/YYYY-MM-DD-*.md: ## Assumptions, ## What Was Tried, ## Conclusions
 *    - docs/adr/NNN-*.md: ## Status, ## Context, ## Decision, ## Consequences
 *    - Lifecycle format check for ## Assumptions items: - [ ] **Active:** / - [x] **Verified:** / - [-] **Refuted:**
 * 4. Sequential numbering for docs/adr/NNN-*.md and docs/research/NN-*.md, plus date formatting for docs/experiments/YYYY-MM-DD-*.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");

interface Frontmatter {
  id?: string;
  title?: string;
  type?: string;
  status?: string;
  date?: string;
  tags?: string[] | string;
  aliases?: string[] | string;
  [key: string]: unknown;
}

interface MarkdownDoc {
  absPath: string;
  repoRelPath: string;
  vaultRelPath: string;
  vaultRelPathNoExt: string;
  repoRelPathNoExt: string;
  basenameNoExt: string;
  rawContent: string;
  bodyContent: string;
  frontmatter: Frontmatter | null;
  frontmatterErrors: string[];
  headings: Set<string>;
  rawHeadings: string[];
}

const REQUIRED_FRONTMATTER_KEYS = [
  "id",
  "title",
  "type",
  "status",
  "date",
  "tags",
  "aliases",
] as const;

const REQUIRED_TEMPLATES = [
  "docs/templates/research-chapter.md",
  "docs/templates/adr.md",
  "docs/templates/experiment.md",
  "docs/templates/paper-note.md",
];

function normalizeHeadingSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function normalizeHeadingText(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ");
}

function stripCodeBlocks(content: string): string {
  const withoutFenced = content.replace(/```[\s\S]*?```/g, "");
  return withoutFenced.replace(/`[^`\n]+`/g, "");
}

function parseYamlFrontmatter(raw: string): {
  frontmatter: Frontmatter | null;
  body: string;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    return {
      frontmatter: null,
      body: raw,
      errors: ["Missing opening YAML frontmatter delimiter '---' on line 1"],
    };
  }

  const endMatch = raw.match(/\r?\n---\r?\n/);
  if (!endMatch || endMatch.index === undefined) {
    return {
      frontmatter: null,
      body: raw,
      errors: ["Missing closing YAML frontmatter delimiter '---'"],
    };
  }

  const yamlText = raw.slice(4, endMatch.index);
  const body = raw.slice(endMatch.index + endMatch[0].length);
  const fm: Frontmatter = {};
  const lines = yamlText.split(/\r?\n/);

  let currentListKey: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const listItemMatch = line.match(/^\s+-\s+(.*)$/);
    if (listItemMatch && currentListKey) {
      const val = listItemMatch[1].trim().replace(/^["']|["']$/g, "");
      const existing = fm[currentListKey];
      if (Array.isArray(existing)) {
        existing.push(val);
      } else {
        fm[currentListKey] = [val];
      }
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kvMatch) {
      errors.push(`Invalid YAML frontmatter syntax at line ${i + 2}: '${line}'`);
      continue;
    }

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

  return { frontmatter: fm, body, errors };
}

function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".obsidian" ||
      entry.name === "templates"
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function extractHeadings(markdownBody: string): {
  headings: Set<string>;
  rawHeadings: string[];
} {
  const headings = new Set<string>();
  const rawHeadings: string[] = [];
  const lines = markdownBody.split(/\r?\n/);
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const headingText = match[2].trim();
      rawHeadings.push(headingText);
      headings.add(normalizeHeadingSlug(headingText));
      headings.add(normalizeHeadingText(headingText));
    }
  }
  return { headings, rawHeadings };
}

function parseBibtexKeys(bibPath: string): Set<string> {
  const keys = new Set<string>();
  if (!fs.existsSync(bibPath)) {
    return keys;
  }
  const content = fs.readFileSync(bibPath, "utf8");
  const regex = /@[A-Za-z]+\s*\{\s*([A-Za-z0-9_:-]+)\s*,/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function parseSourcesMdKeys(sourcesPath: string): Set<string> {
  const keys = new Set<string>();
  if (!fs.existsSync(sourcesPath)) {
    return keys;
  }
  const content = fs.readFileSync(sourcesPath, "utf8");
  const regex = /\|\s*`?\[?@([A-Za-z0-9_:-]+)\]?`?\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function main(): void {
  const errors: string[] = [];

  // 0. Check required templates exist in docs/templates/
  for (const tplRel of REQUIRED_TEMPLATES) {
    const tplAbs = path.join(REPO_ROOT, tplRel);
    if (!fs.existsSync(tplAbs)) {
      errors.push(`[Templates] Missing required template file: ${tplRel}`);
    }
  }

  // 1. Load all non-template Markdown documents from docs/, citations/, + root README.md
  const mdFiles = [
    ...collectMarkdownFiles(DOCS_ROOT),
    ...collectMarkdownFiles(path.join(REPO_ROOT, "citations")),
  ];
  const rootReadme = path.join(REPO_ROOT, "README.md");
  if (fs.existsSync(rootReadme)) {
    mdFiles.push(rootReadme);
  }

  const docs: MarkdownDoc[] = [];

  const byPathKey = new Map<string, MarkdownDoc>();
  const byBasename = new Map<string, MarkdownDoc[]>();
  const byIdOrAlias = new Map<string, MarkdownDoc>();

  for (const absPath of mdFiles) {
    const repoRelPath = path.relative(REPO_ROOT, absPath).replace(/\\/g, "/");
    const repoRelPathNoExt = repoRelPath.replace(/\.md$/, "");
    const isInsideDocs = repoRelPath.startsWith("docs/");
    const vaultRelPath = isInsideDocs
      ? path.relative(DOCS_ROOT, absPath).replace(/\\/g, "/")
      : repoRelPath;
    const vaultRelPathNoExt = vaultRelPath.replace(/\.md$/, "");
    const basenameNoExt = path.basename(repoRelPath, ".md");

    const rawContent = fs.readFileSync(absPath, "utf8");
    const { frontmatter, body, errors: fmErrors } =
      parseYamlFrontmatter(rawContent);
    const { headings, rawHeadings } = extractHeadings(body);

    const doc: MarkdownDoc = {
      absPath,
      repoRelPath,
      vaultRelPath,
      vaultRelPathNoExt,
      repoRelPathNoExt,
      basenameNoExt,
      rawContent,
      bodyContent: body,
      frontmatter,
      frontmatterErrors: fmErrors,
      headings,
      rawHeadings,
    };

    docs.push(doc);

    // Index by both vault-relative (e.g. "research/01-...") and repo-relative (e.g. "docs/research/01-...") paths
    byPathKey.set(vaultRelPath.toLowerCase(), doc);
    byPathKey.set(vaultRelPathNoExt.toLowerCase(), doc);
    byPathKey.set(repoRelPath.toLowerCase(), doc);
    byPathKey.set(repoRelPathNoExt.toLowerCase(), doc);

    const baseKey = basenameNoExt.toLowerCase();
    const list = byBasename.get(baseKey) ?? [];
    list.push(doc);
    byBasename.set(baseKey, list);

    if (frontmatter) {
      if (typeof frontmatter.id === "string" && frontmatter.id.trim()) {
        byIdOrAlias.set(frontmatter.id.trim().toLowerCase(), doc);
      }
      const aliases = frontmatter.aliases;
      if (Array.isArray(aliases)) {
        for (const alias of aliases) {
          if (alias.trim()) {
            byIdOrAlias.set(alias.trim().toLowerCase(), doc);
          }
        }
      } else if (typeof aliases === "string" && aliases.trim()) {
        byIdOrAlias.set(aliases.trim().toLowerCase(), doc);
      }
    }
  }

  // 2. Schema, Frontmatter & Required Section checks
  const assumptionLifecycleRegex =
    /^-\s+\[( |x|-)\]\s+\*\*(Active|Verified|Refuted):\*\*\s+.+#assumption\b/;

  for (const doc of docs) {
    for (const err of doc.frontmatterErrors) {
      errors.push(`[Frontmatter] ${doc.repoRelPath}: ${err}`);
    }
    if (!doc.frontmatter) {
      continue;
    }

    for (const key of REQUIRED_FRONTMATTER_KEYS) {
      const val = doc.frontmatter[key];
      if (
        val === undefined ||
        val === null ||
        (typeof val === "string" && val.trim() === "") ||
        (Array.isArray(val) && val.length === 0)
      ) {
        errors.push(
          `[Frontmatter] ${doc.repoRelPath}: Missing or empty required frontmatter field '${key}'`
        );
      }
    }

    if (
      typeof doc.frontmatter.date === "string" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(doc.frontmatter.date)
    ) {
      errors.push(
        `[Frontmatter] ${doc.repoRelPath}: Field 'date' must be YYYY-MM-DD (got '${doc.frontmatter.date}')`
      );
    }

    const isResearchChapter = doc.vaultRelPath.startsWith("research/");
    const isExperimentLog =
      doc.vaultRelPath.startsWith("experiments/") &&
      path.basename(doc.vaultRelPath) !== "README.md";

    if (isResearchChapter || isExperimentLog) {
      const requiredSections = isResearchChapter
        ? ["assumptions", "what was tried", "conclusions", "revision log"]
        : ["assumptions", "what was tried", "conclusions"];

      for (const reqSec of requiredSections) {
        if (!doc.headings.has(reqSec)) {
          errors.push(
            `[Epistemic Schema] ${doc.repoRelPath}: Missing required section heading '## ${reqSec
              .split(" ")
              .map((w) => w[0].toUpperCase() + w.slice(1))
              .join(" ")}'`
          );
        }
      }

      const assumptionLines = doc.bodyContent
        .split(/\r?\n/)
        .filter((l) => l.includes("#assumption") && !l.trim().startsWith(">"));
      if (assumptionLines.length === 0) {
        errors.push(
          `[Epistemic Schema] ${doc.repoRelPath}: Must contain at least one lifecycle-tracked '#assumption' item`
        );
      }
      for (const line of assumptionLines) {
        const trimmed = line.trim();
        if (!assumptionLifecycleRegex.test(trimmed)) {
          errors.push(
            `[Assumption Lifecycle] ${doc.repoRelPath}: Assumption line must follow lifecycle format '- [ ] **Active:** ... #assumption' | '- [x] **Verified:** ... #assumption' | '- [-] **Refuted:** ... #assumption' (got: '${trimmed}')`
          );
          continue;
        }
        const isResolved =
          trimmed.startsWith("- [x] **Verified:**") ||
          trimmed.startsWith("- [-] **Refuted:**");
        if (
          isResolved &&
          !/\[\[(?:docs\/)?experiments\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+/.test(
            trimmed
          )
        ) {
          errors.push(
            `[Unverified Claim Guard] ${doc.repoRelPath}: Assumption cannot be marked 'Verified' or 'Refuted' without linking an executed experiment log '[[experiments/YYYY-MM-DD-...]]' (got: '${trimmed}')`
          );
        }
      }
    }

    const isAdr =
      doc.vaultRelPath.startsWith("adr/") &&
      path.basename(doc.vaultRelPath) !== "README.md";
    if (isAdr) {
      const requiredAdrSections = [
        "status",
        "context",
        "decision",
        "consequences",
      ];
      for (const reqSec of requiredAdrSections) {
        if (!doc.headings.has(reqSec)) {
          errors.push(
            `[ADR Schema] ${doc.repoRelPath}: Missing required ADR section heading '## ${
              reqSec[0].toUpperCase() + reqSec.slice(1)
            }'`
          );
        }
      }
    }
  }

  // 3. Naming & Sequential Numbering checks
  const adrFiles = docs
    .filter(
      (d) =>
        d.vaultRelPath.startsWith("adr/") &&
        path.basename(d.vaultRelPath) !== "README.md"
    )
    .map((d) => path.basename(d.vaultRelPath))
    .sort();

  const adrPattern = /^(\d{3})-[a-z0-9-]+\.md$/;
  for (let i = 0; i < adrFiles.length; i++) {
    const file = adrFiles[i];
    const match = file.match(adrPattern);
    if (!match) {
      errors.push(
        `[Naming] docs/adr/${file}: Must match sequential pattern 'NNN-<kebab-slug>.md'`
      );
      continue;
    }
    const expectedNum = String(i + 1).padStart(3, "0");
    if (match[1] !== expectedNum) {
      errors.push(
        `[Numbering] docs/adr/${file}: Expected sequential number '${expectedNum}', found '${match[1]}'`
      );
    }
  }

  const expFiles = docs
    .filter(
      (d) =>
        d.vaultRelPath.startsWith("experiments/") &&
        path.basename(d.vaultRelPath) !== "README.md"
    )
    .map((d) => path.basename(d.vaultRelPath))
    .sort();

  const expPattern = /^(\d{4}-\d{2}-\d{2})-[a-z0-9-]+\.md$/;
  for (const file of expFiles) {
    const match = file.match(expPattern);
    if (!match) {
      errors.push(
        `[Naming] docs/experiments/${file}: Must match date pattern 'YYYY-MM-DD-<kebab-slug>.md'`
      );
      continue;
    }
    const parsedDate = new Date(`${match[1]}T00:00:00Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== match[1]
    ) {
      errors.push(
        `[Naming] docs/experiments/${file}: Invalid calendar date '${match[1]}'`
      );
    }
  }

  const researchFiles = docs
    .filter(
      (d) =>
        d.vaultRelPath.startsWith("research/") &&
        path.basename(d.vaultRelPath) !== "README.md"
    )
    .map((d) => path.basename(d.vaultRelPath))
    .sort();

  const researchPattern = /^(\d{2})-[a-z0-9-]+\.md$/;
  for (let i = 0; i < researchFiles.length; i++) {
    const file = researchFiles[i];
    const match = file.match(researchPattern);
    if (!match) {
      errors.push(
        `[Naming] docs/research/${file}: Must match chapter pattern 'NN-<kebab-slug>.md'`
      );
      continue;
    }
    const expectedNum = String(i + 1).padStart(2, "0");
    if (match[1] !== expectedNum) {
      errors.push(
        `[Numbering] docs/research/${file}: Expected sequential chapter number '${expectedNum}', found '${match[1]}'`
      );
    }
  }

  // 4. Wikilink Integrity checks
  const wikilinkRegex = /\[\[([^\[\]]+)\]\]/g;
  let totalWikilinks = 0;

  for (const doc of docs) {
    const cleanBody = stripCodeBlocks(doc.bodyContent);
    let match: RegExpExecArray | null;
    while ((match = wikilinkRegex.exec(cleanBody)) !== null) {
      totalWikilinks++;
      const rawInner = match[1].trim();
      const unescapedInner = rawInner.replace(/\\\|/g, "|");
      const [targetAndHeading] = unescapedInner.split("|");
      const [rawTarget, rawHeading] = targetAndHeading.split("#");
      const target = rawTarget.trim();
      const heading = rawHeading?.trim();

      let resolvedDoc: MarkdownDoc | undefined;

      if (target === "") {
        resolvedDoc = doc;
      } else {
        const key = target.toLowerCase().replace(/\\/g, "/");
        resolvedDoc = byPathKey.get(key) ?? byIdOrAlias.get(key);

        if (!resolvedDoc) {
          const relToCurrent = path
            .posix.join(path.posix.dirname(doc.vaultRelPath), key)
            .replace(/\.md$/, "");
          resolvedDoc = byPathKey.get(relToCurrent);
        }

        if (!resolvedDoc) {
          const baseCandidates = byBasename.get(key);
          if (baseCandidates && baseCandidates.length === 1) {
            resolvedDoc = baseCandidates[0];
          } else if (baseCandidates && baseCandidates.length > 1) {
            errors.push(
              `[Wikilink] ${doc.repoRelPath}: Ambiguous wikilink '[[${rawInner}]]' matches multiple files (${baseCandidates
                .map((c) => c.repoRelPath)
                .join(", ")})`
            );
            continue;
          }
        }
      }

      if (!resolvedDoc) {
        errors.push(
          `[Wikilink] ${doc.repoRelPath}: Broken wikilink '[[${rawInner}]]' (target '${target}' does not resolve to any document)`
        );
        continue;
      }

      if (heading) {
        const slug = normalizeHeadingSlug(heading);
        const text = normalizeHeadingText(heading);
        if (!resolvedDoc.headings.has(slug) && !resolvedDoc.headings.has(text)) {
          errors.push(
            `[Wikilink Heading] ${doc.repoRelPath}: Broken heading anchor in '[[${rawInner}]]' ('#${heading}' not found in ${resolvedDoc.repoRelPath})`
          );
        }
      }
    }
  }

  // 5. Citation Integrity checks
  const bibPath = path.join(REPO_ROOT, "citations", "references.bib");
  const sourcesPath = path.join(REPO_ROOT, "citations", "sources.md");

  const bibKeys = parseBibtexKeys(bibPath);
  const sourcesKeys = parseSourcesMdKeys(sourcesPath);

  if (bibKeys.size === 0) {
    errors.push(
      `[Citations] citations/references.bib is missing or contains zero BibTeX entries`
    );
  }
  if (sourcesKeys.size === 0) {
    errors.push(
      `[Citations] citations/sources.md is missing or contains zero indexed citation keys`
    );
  }

  for (const key of bibKeys) {
    if (!sourcesKeys.has(key)) {
      errors.push(
        `[Citations] Key '@${key}' exists in citations/references.bib but is missing from citations/sources.md`
      );
    }
  }
  const pdfDir = path.join(REPO_ROOT, "citations", "pdfs");
  const hasPopulatedPdfSubmodule =
    fs.existsSync(pdfDir) &&
    fs.readdirSync(pdfDir).some((f) => f.endsWith(".pdf"));

  for (const key of sourcesKeys) {
    if (!bibKeys.has(key)) {
      errors.push(
        `[Citations] Key '@${key}' exists in citations/sources.md but is missing from citations/references.bib`
      );
    }
    if (hasPopulatedPdfSubmodule) {
      const pdfFile = path.join(pdfDir, `${key}.pdf`);
      if (!fs.existsSync(pdfFile)) {
        errors.push(
          `[Citations PDF] Missing downloaded PDF at citations/pdfs/${key}.pdf`
        );
      } else {
        const fd = fs.openSync(pdfFile, "r");
        const buf = Buffer.alloc(5);
        fs.readSync(fd, buf, 0, 5, 0);
        fs.closeSync(fd);
        if (buf.toString("ascii") !== "%PDF-") {
          errors.push(
            `[Citations PDF] File citations/pdfs/${key}.pdf does not have a valid '%PDF-' magic header`
          );
        }
      }
    }

    const htmlFile = path.join(REPO_ROOT, "citations", "html", `${key}.html`);
    if (!fs.existsSync(htmlFile)) {
      errors.push(
        `[Citations HTML] Missing downloaded reference HTML at citations/html/${key}.html`
      );
    } else {
      const stat = fs.statSync(htmlFile);
      if (stat.size < 1024) {
        errors.push(
          `[Citations HTML] Reference HTML citations/html/${key}.html is unexpectedly small (${stat.size} bytes)`
        );
      }
    }
  }

  const citationDirs = [
    "research/",
    "architecture/",
    "adr/",
    "experiments/",
  ];
  const citationBlockRegex =
    /\[(@[A-Za-z0-9_:-]+(?:\s*;\s*@[A-Za-z0-9_:-]+)*)\]/g;
  let totalCitations = 0;

  for (const doc of docs) {
    if (
      !citationDirs.some((prefix) => doc.vaultRelPath.startsWith(prefix)) &&
      doc.repoRelPath !== "README.md"
    ) {
      continue;
    }
    const cleanBody = stripCodeBlocks(doc.bodyContent);
    let match: RegExpExecArray | null;
    while ((match = citationBlockRegex.exec(cleanBody)) !== null) {
      const inner = match[1];
      const citeKeys = inner
        .split(";")
        .map((s) => s.trim().replace(/^@/, ""))
        .filter(Boolean);

      for (const citeKey of citeKeys) {
        totalCitations++;
        if (!bibKeys.has(citeKey)) {
          errors.push(
            `[Citation] ${doc.repoRelPath}: Reference '[@${citeKey}]' not found in citations/references.bib`
          );
        }
        if (!sourcesKeys.has(citeKey)) {
          errors.push(
            `[Citation] ${doc.repoRelPath}: Reference '[@${citeKey}]' not found in citations/sources.md`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error(
      `❌ Consistency check failed with ${errors.length} error(s):\n`
    );
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log("✅ All zmem-research consistency checks passed!");
  console.log(
    `   Documents validated : ${docs.length} (${researchFiles.length} chapters, ${adrFiles.length} ADRs, ${expFiles.length} experiment logs under docs/)`
  );
  console.log(`   Wikilinks verified  : ${totalWikilinks}`);
  console.log(
    `   Citations verified  : ${totalCitations} references across ${bibKeys.size} unique BibTeX keys`
  );
}

main();
