import * as path from "node:path";
import { Marked, Renderer } from "marked";
import { computeRelativeHref } from "./discovery.js";
import type { PageEntry, TocHeading } from "./types.js";

const ALERT_PALETTE: Record<string, { alertClass: string; label: string }> = {
  NOTE: {
    alertClass: "alert-info",
    label: "Note",
  },
  TIP: {
    alertClass: "alert-success",
    label: "Tip",
  },
  IMPORTANT: {
    alertClass: "alert-info",
    label: "Important",
  },
  WARNING: {
    alertClass: "alert-warning",
    label: "Warning",
  },
  CAUTION: {
    alertClass: "alert-error",
    label: "Caution",
  },
};

const ASSUMPTION_BADGE_STYLES: Record<string, string> = {
  Active: "badge-warning",
  Verified: "badge-success",
  Refuted: "badge-error",
};

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function transformAlertsAndAssumptions(rawBody: string): string {
  const lines = rawBody.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const alertMatch = lines[i].match(
      /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i
    );
    if (alertMatch) {
      const kind = alertMatch[1].toUpperCase();
      const firstLineRest = alertMatch[2].trim();
      const alertBody: string[] = [];
      if (firstLineRest) alertBody.push(firstLineRest);
      i++;
      while (i < lines.length && /^>\s?(.*)$/.test(lines[i])) {
        const m = lines[i].match(/^>\s?(.*)$/);
        if (m) alertBody.push(m[1]);
        i++;
      }

      const style = ALERT_PALETTE[kind] ?? ALERT_PALETTE.NOTE;
      out.push(
        `<div role="alert" class="alert ${style.alertClass} my-4 shadow-sm not-prose block">`,
        `<div class="text-xs font-bold uppercase tracking-wider mb-1">${style.label}</div>`,
        `<div class="text-sm leading-relaxed">\n\n${alertBody.join(
          "\n"
        )}\n\n</div>`,
        `</div>`
      );
      continue;
    }

    const assumptionMatch = lines[i].match(
      /^-\s+\[( |x|-)\]\s+\*\*(Active|Verified|Refuted):\*\*\s+(.+)$/
    );
    if (assumptionMatch) {
      const state = assumptionMatch[2];
      const rest = assumptionMatch[3].replace(
        /\s*#assumption\b/g,
        ' <span class="badge badge-ghost badge-sm font-mono">#assumption</span>'
      );
      const cls =
        ASSUMPTION_BADGE_STYLES[state] ?? ASSUMPTION_BADGE_STYLES.Active;
      out.push(
        `- <span class="badge ${cls} badge-sm font-semibold mr-1.5">${state}</span> ${rest}`
      );
      i++;
      continue;
    }

    out.push(lines[i]);
    i++;
  }

  return out.join("\n");
}

function resolveWikilinksAndCitations(
  markdown: string,
  currentPage: PageEntry,
  lookup: Map<string, PageEntry>
): string {
  const codePlaceholders: string[] = [];

  let processed = markdown.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    if (/^`\[@[A-Za-z0-9_:-]+\]`$/.test(match)) {
      const key = match.slice(3, -2);
      return `<code id="cite-${key}" class="badge badge-primary badge-outline badge-sm font-mono">[@${key}]</code>`;
    }
    if (
      currentPage.repoRelPath === "citations/sources.md" &&
      /^`[a-z0-9_:-]+\.(pdf|html)`$/i.test(match)
    ) {
      const filename = match.slice(1, -1);
      const subFolder = filename.endsWith(".pdf") ? "pdfs" : "html";
      const targetRel = `citations/${subFolder}/${filename}`;
      const href = computeRelativeHref(currentPage.outRelHtmlPath, targetRel);
      return `<a href="${href}" class="btn btn-xs btn-outline btn-info font-mono no-underline">${filename}</a>`;
    }
    const idx = codePlaceholders.length;
    codePlaceholders.push(match);
    return `@@CODE_PLACEHOLDER_${idx}@@`;
  });

  // Resolve Obsidian [[wikilinks]]
  processed = processed.replace(/\[\[([^\[\]]+)\]\]/g, (_full, rawInner) => {
    const unescaped = String(rawInner).trim().replace(/\\\|/g, "|");
    const [targetAndHeading, customLabel] = unescaped.split("|");
    const [rawTarget, rawHeading] = targetAndHeading.split("#");
    const target = rawTarget.trim();
    const heading = rawHeading?.trim();

    let targetPage: PageEntry | undefined;
    if (target === "") {
      targetPage = currentPage;
    } else {
      const key = target.toLowerCase().replace(/\\/g, "/");
      targetPage = lookup.get(key);
      if (!targetPage) {
        const relKey = path.posix
          .join(path.posix.dirname(currentPage.vaultRelPath), key)
          .replace(/\.md$/, "");
        targetPage = lookup.get(relKey);
      }
    }

    const display =
      customLabel?.trim() ||
      (targetPage ? targetPage.frontmatter.title : target || heading || "Link");

    if (!targetPage) {
      return `<span class="badge badge-warning badge-outline">${display}</span>`;
    }

    let href = computeRelativeHref(
      currentPage.outRelHtmlPath,
      targetPage.outRelHtmlPath
    );
    if (heading) {
      href += `#${slugifyHeading(heading)}`;
    }
    return `[${display}](${href})`;
  });

  // Resolve [@citekey] and [@key1; @key2] citations
  const hrefToSources = computeRelativeHref(
    currentPage.outRelHtmlPath,
    "citations/sources.html"
  );

  processed = processed.replace(
    /\[(@[A-Za-z0-9_:-]+(?:\s*;\s*@[A-Za-z0-9_:-]+)*)\]/g,
    (_full, inner: string) => {
      const keys = inner
        .split(";")
        .map((s) => s.trim().replace(/^@/, ""))
        .filter(Boolean);
      const links = keys.map(
        (k) =>
          `<a href="${hrefToSources}#cite-${k}" class="link link-primary font-mono text-xs no-underline hover:underline">@${k}</a>`
      );
      return `<span class="badge badge-neutral badge-sm gap-1 font-mono">[${links.join(
        "; "
      )}]</span>`;
    }
  );

  return processed.replace(
    /@@CODE_PLACEHOLDER_(\d+)@@/g,
    (_m, idxStr) => codePlaceholders[Number(idxStr)]
  );
}

export function renderPageMarkdown(
  page: PageEntry,
  lookup: Map<string, PageEntry>
): {
  html: string;
  headings: TocHeading[];
} {
  const withBlocks = transformAlertsAndAssumptions(page.rawBody);
  const preprocessed = resolveWikilinksAndCitations(withBlocks, page, lookup);

  const headings: TocHeading[] = [];
  const renderer = new Renderer();

  renderer.heading = ({ text, depth }) => {
    const plainText = text.replace(/<[^>]+>/g, "");
    const slug = slugifyHeading(plainText);
    if (depth === 2 || depth === 3) {
      headings.push({ level: depth, text: plainText, slug });
    }
    const Tag = `h${depth}`;
    return `<${Tag} id="${slug}" class="group scroll-mt-20">${text} <a href="#${slug}" class="opacity-0 group-hover:opacity-100 text-base-content/40 hover:text-primary ml-1 text-sm no-underline transition-opacity" aria-label="Anchor">#</a></${Tag}>\n`;
  };

  renderer.code = ({ text, lang }) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (lang === "mermaid") {
      return `<div class="card bg-base-200 border border-base-300 my-6 p-4 overflow-x-auto not-prose"><pre class="mermaid text-center text-sm">${escaped}</pre></div>\n`;
    }

    const langBadge = lang
      ? `<div class="flex items-center justify-between px-4 py-1.5 bg-base-300 border-b border-base-content/10 text-[11px] font-mono text-base-content/70 uppercase tracking-wider"><span>${lang}</span></div>`
      : "";
    return `<div class="card bg-base-300/60 border border-base-300 my-4 overflow-hidden not-prose">${langBadge}<pre class="p-4 overflow-x-auto text-xs font-mono leading-relaxed"><code>${escaped}</code></pre></div>\n`;
  };

  const markedInstance = new Marked({ renderer, gfm: true, breaks: false });
  const html = markedInstance.parse(preprocessed) as string;
  return { html, headings };
}
