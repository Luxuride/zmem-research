#!/usr/bin/env node
/**
 * Generator & Index Synchronization CLI for zmem-research (TypeScript / tsx)
 *
 * Commands:
 *   new-adr <slug>       Create the next sequentially numbered ADR in docs/adr/NNN-<slug>.md
 *   new-exp <slug>       Create docs/experiments/YYYY-MM-DD-<slug>.md
 *   sync-indexes         Auto-generate/update docs/INDEX.md and auto-index markers in README.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DOCS_ROOT = path.join(REPO_ROOT, "docs");

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slugToTitle(slug: string): string {
  const acronyms = new Set([
    "adr",
    "api",
    "abi",
    "bdi",
    "bio",
    "blk",
    "cpu",
    "ffi",
    "fio",
    "fpu",
    "gc",
    "gfp",
    "io",
    "kasan",
    "kbox",
    "kvec",
    "lz4",
    "mm",
    "mq",
    "noio",
    "numa",
    "ops",
    "psi",
    "ram",
    "rbrd",
    "rnull",
    "simd",
    "swar",
    "tmo",
    "vm",
    "wkdm",
    "zmem",
    "zram",
    "zsmalloc",
    "zstd",
    "zswap",
  ]);
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (acronyms.has(lower)) {
        return lower.toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderTemplate(
  templateContent: string,
  vars: Record<string, string>
): string {
  let result = templateContent;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
}

function extractFrontmatterField(content: string, key: string): string {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return "";
  const regex = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = fmMatch[1].match(regex);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

function createNewAdr(rawSlug: string): void {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) {
    console.error("Error: Provide a non-empty slug for new-adr.");
    process.exit(1);
  }

  const adrDir = path.join(DOCS_ROOT, "adr");
  fs.mkdirSync(adrDir, { recursive: true });

  const existing = fs
    .readdirSync(adrDir)
    .filter((f) => /^\d{3}-.*\.md$/.test(f))
    .sort();

  const nextNum = String(existing.length + 1).padStart(3, "0");
  const id = `ADR-${nextNum}`;
  const title = slugToTitle(slug);
  const date = todayIsoDate();
  const filename = `${nextNum}-${slug}.md`;
  const targetPath = path.join(adrDir, filename);

  if (fs.existsSync(targetPath)) {
    console.error(`Error: ADR already exists at docs/adr/${filename}`);
    process.exit(1);
  }

  const tplPath = path.join(DOCS_ROOT, "templates", "adr.md");
  const tpl = fs.readFileSync(tplPath, "utf8");
  const rendered = renderTemplate(tpl, { id, title, date, slug });

  fs.writeFileSync(targetPath, rendered, "utf8");
  console.log(`✅ Created docs/adr/${filename} (${id}: ${title})`);
}

function createNewExp(rawSlug: string): void {
  const slug = sanitizeSlug(rawSlug);
  if (!slug) {
    console.error("Error: Provide a non-empty slug for new-exp.");
    process.exit(1);
  }

  const expDir = path.join(DOCS_ROOT, "experiments");
  fs.mkdirSync(expDir, { recursive: true });

  const date = todayIsoDate();
  const id = `EXP-${date}-${slug}`;
  const title = slugToTitle(slug);
  const filename = `${date}-${slug}.md`;
  const targetPath = path.join(expDir, filename);

  if (fs.existsSync(targetPath)) {
    console.error(
      `Error: Experiment log already exists at docs/experiments/${filename}`
    );
    process.exit(1);
  }

  const tplPath = path.join(DOCS_ROOT, "templates", "experiment.md");
  const tpl = fs.readFileSync(tplPath, "utf8");
  const rendered = renderTemplate(tpl, { id, title, date, slug });

  fs.writeFileSync(targetPath, rendered, "utf8");
  console.log(`✅ Created docs/experiments/${filename} (${id})`);
}

interface DocSummary {
  vaultRelNoExt: string;
  id: string;
  title: string;
  status: string;
  date: string;
}

function scanDirectorySummaries(subDir: string): DocSummary[] {
  const dir = path.join(DOCS_ROOT, subDir);
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  return files.map((file) => {
    const full = path.join(dir, file);
    const content = fs.readFileSync(full, "utf8");
    const vaultRelNoExt = `${subDir}/${file.replace(/\.md$/, "")}`;
    return {
      vaultRelNoExt,
      id: extractFrontmatterField(content, "id") || file.replace(/\.md$/, ""),
      title: extractFrontmatterField(content, "title") || file,
      status: extractFrontmatterField(content, "status") || "draft",
      date: extractFrontmatterField(content, "date") || todayIsoDate(),
    };
  });
}

interface AssumptionEntry {
  sourceRelNoExt: string;
  sourceId: string;
  checkbox: string;
  state: string;
  text: string;
}

function collectAssumptions(): AssumptionEntry[] {
  const results: AssumptionEntry[] = [];
  const dirs = ["research", "experiments"];
  const regex =
    /^-\s+\[( |x|-)\]\s+\*\*(Active|Verified|Refuted):\*\*\s+(.+?)\s*#assumption\b/;

  for (const subDir of dirs) {
    const dir = path.join(DOCS_ROOT, subDir);
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .sort();

    for (const file of files) {
      const full = path.join(dir, file);
      const content = fs.readFileSync(full, "utf8");
      const relPathNoExt = `${subDir}/${file.replace(/\.md$/, "")}`;
      const sourceId =
        extractFrontmatterField(content, "id") || file.replace(/\.md$/, "");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const match = line.trim().match(regex);
        if (match) {
          results.push({
            sourceRelNoExt: relPathNoExt,
            sourceId,
            checkbox: match[1],
            state: match[2],
            text: match[3].trim(),
          });
        }
      }
    }
  }
  return results;
}

function syncIndexes(): void {
  const chapters = scanDirectorySummaries("research");
  const archDocs = scanDirectorySummaries("architecture");
  const adrs = scanDirectorySummaries("adr");
  const experiments = scanDirectorySummaries("experiments");
  const assumptions = collectAssumptions();
  const date = todayIsoDate();

  const chapterRows = chapters
    .map(
      (c) =>
        `| \`${c.id}\` | [[${c.vaultRelNoExt}\\|${c.title}]] | \`${c.status}\` | ${c.date} |`
    )
    .join("\n");

  const archRows = archDocs
    .map(
      (a) =>
        `| \`${a.id}\` | [[${a.vaultRelNoExt}\\|${a.title}]] | \`${a.status}\` | ${a.date} |`
    )
    .join("\n");

  const adrRows = adrs
    .map(
      (a) =>
        `| \`${a.id}\` | [[${a.vaultRelNoExt}\\|${a.title}]] | \`${a.status}\` | ${a.date} |`
    )
    .join("\n");

  const expRows =
    experiments.length > 0
      ? experiments
          .map(
            (e) =>
              `| \`${e.date}\` | [[${e.vaultRelNoExt}\\|${e.title}]] | \`${e.status}\` |`
          )
          .join("\n")
      : `| — | *No experiment runs logged yet (see [[experiments/README]])* | — |`;

  const assumptionLines = assumptions
    .map(
      (a) =>
        `- [${a.checkbox}] **${a.state}** ([[${a.sourceRelNoExt}|${a.sourceId}]]): ${a.text}`
    )
    .join("\n");

  const indexMd = `---
id: INDEX
title: "zmem Knowledge Base Master Index"
type: index
status: active
date: "${date}"
tags:
  - zmem
  - index
  - moc
aliases:
  - "Master Index"
  - "Master Knowledge Base Index (MOC)"
  - "MOC"
---

# \`zmem\` Knowledge Base Master Index

> [!NOTE]
> This Map of Content (MOC) is synchronized by \`npx tsx scripts/gen.ts sync-indexes\`. Open the \`docs/\` directory as your Obsidian Vault root to browse the full knowledge graph.

## 1. Living Research Chapters (\`docs/research/\`)

| ID | Chapter | Status | Last Updated |
| :--- | :--- | :--- | :--- |
${chapterRows}

## 2. Living Architecture Specifications (\`docs/architecture/\`)

| ID | Specification | Status | Last Updated |
| :--- | :--- | :--- | :--- |
${archRows}

## 3. Immutable Architecture Decision Records (\`docs/adr/\`)

| ADR | Decision Title | Status | Date |
| :--- | :--- | :--- | :--- |
${adrRows}

## 4. Immutable Experiment Logs (\`docs/experiments/\`)

See [[experiments/README|Experiment Workflow Guide]] for instructions on recording new runs.

| Date | Experiment | Status |
| :--- | :--- | :--- |
${expRows}

## 5. Glossary, Changelog & Citations (\`citations/\`)

* **Plain-English Terminology Glossary:** [[GLOSSARY|Plain-English Glossary of Kernel & Memory Compression Terms]]
* **Milestone Changelog:** [[CHANGELOG|Research & Architecture Milestone Changelog]]
* **Citation Index & License Registry:** [[citations/sources|Master Citation Sources Table]]
* **Private PDF Submodule Guide:** [[citations/sources#Private PDF Submodule (citations/pdfs/)|Reference PDFs Submodule Guide (citations/pdfs/)]]

## 6. Assumptions Lifecycle Registry (\`#assumption\`)

${assumptionLines}
`;

  fs.writeFileSync(path.join(DOCS_ROOT, "INDEX.md"), indexMd, "utf8");

  const readmePath = path.join(REPO_ROOT, "README.md");
  if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, "utf8");
    const startMarker = "<!-- AUTO-INDEX:START -->";
    const endMarker = "<!-- AUTO-INDEX:END -->";
    const startIdx = readmeContent.indexOf(startMarker);
    const endIdx = readmeContent.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const summaryBlock = `${startMarker}
### Research Chapters (\`docs/research/\`)

| ID | Chapter | Status |
| :--- | :--- | :--- |
${chapters
  .map(
    (c) =>
      `| \`${c.id}\` | [[${c.vaultRelNoExt}\\|${c.title}]] | \`${c.status}\` |`
  )
  .join("\n")}

### Architecture Specifications (\`docs/architecture/\`)

| ID | Specification | Status |
| :--- | :--- | :--- |
${archDocs
  .map(
    (a) =>
      `| \`${a.id}\` | [[${a.vaultRelNoExt}\\|${a.title}]] | \`${a.status}\` |`
  )
  .join("\n")}

### Architecture Decision Records (\`docs/adr/\`)

| ADR | Decision | Status | Date |
| :--- | :--- | :--- | :--- |
${adrRows}

### Recent Experiments (\`docs/experiments/\`)

| Date | Experiment | Status |
| :--- | :--- | :--- |
${expRows}
${endMarker}`;

      const updatedReadme =
        readmeContent.slice(0, startIdx) +
        summaryBlock +
        readmeContent.slice(endIdx + endMarker.length);
      fs.writeFileSync(readmePath, updatedReadme, "utf8");
    }
  }

  console.log(
    `✅ Synchronized docs/INDEX.md and README.md (${chapters.length} chapters, ${archDocs.length} specs, ${adrs.length} ADRs, ${experiments.length} experiments, ${assumptions.length} lifecycle assumptions).`
  );
}

function printUsage(): void {
  console.log(`Usage:
  npx tsx scripts/gen.ts new-adr <slug>
  npx tsx scripts/gen.ts new-exp <slug>
  npx tsx scripts/gen.ts sync-indexes`);
}

function main(): void {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printUsage();
    process.exit(0);
  }

  switch (cmd) {
    case "new-adr":
      createNewAdr(args.slice(1).join("-"));
      break;
    case "new-exp":
      createNewExp(args.slice(1).join("-"));
      break;
    case "sync-indexes":
      syncIndexes();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printUsage();
      process.exit(1);
  }
}

main();
