import * as path from "node:path";
import katex from "katex";
import { Marked, Renderer } from "marked";
import { computeRelativeHref } from "./discovery.js";
import type { PageEntry, TocHeading } from "./types.js";

const ALERT_STYLES: Record<
  string,
  { borderClass: string; titleClass: string; label: string }
> = {
  NOTE: {
    borderClass: "border-info",
    titleClass: "text-info",
    label: "Note",
  },
  TIP: {
    borderClass: "border-success",
    titleClass: "text-success",
    label: "Tip",
  },
  IMPORTANT: {
    borderClass: "border-primary",
    titleClass: "text-primary",
    label: "Important",
  },
  WARNING: {
    borderClass: "border-warning",
    titleClass: "text-warning",
    label: "Warning",
  },
  CAUTION: {
    borderClass: "border-error",
    titleClass: "text-error",
    label: "Caution",
  },
};

const ASSUMPTION_BADGE_STYLES: Record<string, string> = {
  Active: "badge-warning badge-outline",
  Verified: "badge-success badge-outline",
  Refuted: "badge-error badge-outline",
};

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function slugifyHeading(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveWikilinksAndCitations(
  markdown: string,
  currentPage: PageEntry,
  lookup: Map<string, PageEntry>
): string {
  const codePlaceholders: string[] = [];
  const mathPlaceholders: string[] = [];

  const hrefToSources = computeRelativeHref(
    currentPage.outRelHtmlPath,
    "citations/sources.html"
  );

  let processed = markdown.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    if (/^`\[@[A-Za-z0-9_:-]+\]`$/.test(match)) {
      const key = match.slice(3, -2);
      if (currentPage.repoRelPath === "citations/sources.md") {
        return `<code id="cite-${key}" class="font-mono font-semibold">[@${key}]</code>`;
      }
      return `<a href="${hrefToSources}#cite-${key}" class="font-mono text-sm">[@${key}]</a>`;
    }
    if (
      currentPage.repoRelPath === "citations/sources.md" &&
      /^`[a-z0-9_:-]+\.(pdf|html)`$/i.test(match)
    ) {
      const filename = match.slice(1, -1);
      const subFolder = filename.endsWith(".pdf") ? "pdfs" : "html";
      const targetRel = `citations/${subFolder}/${filename}`;
      const href = computeRelativeHref(currentPage.outRelHtmlPath, targetRel);
      return `<a href="${href}" class="link link-primary font-mono">${filename}</a>`;
    }
    const idx = codePlaceholders.length;
    codePlaceholders.push(match);
    return `@@CODE_PLACEHOLDER_${idx}@@`;
  });

  // Render LaTeX math ($$...$$ and $...$) via KaTeX BEFORE marked strips backslashes (like \_)
  processed = processed.replace(
    /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g,
    (_full, displayExpr?: string, inlineExpr?: string) => {
      const isDisplay = displayExpr !== undefined;
      const expr = (isDisplay ? displayExpr : inlineExpr) ?? "";
      const renderedMath = katex.renderToString(expr.trim(), {
        displayMode: isDisplay,
        throwOnError: true,
      });
      const idx = mathPlaceholders.length;
      mathPlaceholders.push(
        isDisplay
          ? `<div class="my-4 overflow-x-auto">${renderedMath}</div>`
          : renderedMath
      );
      return `@@MATH_PLACEHOLDER_${idx}@@`;
    }
  );

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
      return display;
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
  processed = processed.replace(
    /\[(@[A-Za-z0-9_:-]+(?:\s*;\s*@[A-Za-z0-9_:-]+)*)\]/g,
    (_full, inner: string) => {
      const keys = inner
        .split(";")
        .map((s) => s.trim().replace(/^@/, ""))
        .filter(Boolean);
      const links = keys.map(
        (k) =>
          `<a href="${hrefToSources}#cite-${k}" class="link link-primary font-mono no-underline hover:underline">@${k}</a>`
      );
      return `<span class="font-mono text-base-content/75">[${links.join(
        "; "
      )}]</span>`;
    }
  );

  return processed
    .replace(
      /@@MATH_PLACEHOLDER_(\d+)@@/g,
      (_m, idxStr) => mathPlaceholders[Number(idxStr)]
    )
    .replace(
      /@@CODE_PLACEHOLDER_(\d+)@@/g,
      (_m, idxStr) => codePlaceholders[Number(idxStr)]
    );
}

function transformAlertsAndAssumptions(
  markdown: string,
  inlineParser: Marked
): string {
  const lines = markdown.split(/\r?\n/);
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

      const style = ALERT_STYLES[kind] ?? ALERT_STYLES.NOTE;
      const renderedInner = inlineParser.parse(alertBody.join("\n")) as string;
      out.push(
        `<div role="note" class="my-6 border-l-4 ${style.borderClass} bg-base-200 px-5 py-4 rounded-r-lg">`,
        `<div class="text-xs font-mono font-bold uppercase tracking-wider ${style.titleClass} mb-1">${style.label}</div>`,
        `<div class="text-base leading-relaxed">${renderedInner}</div>`,
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
        ' <span class="font-mono text-xs text-base-content/50">#assumption</span>'
      );
      const cls =
        ASSUMPTION_BADGE_STYLES[state] ?? ASSUMPTION_BADGE_STYLES.Active;
      out.push(
        `- <span class="badge ${cls} badge-sm font-mono font-semibold mr-1.5">${state}</span> ${rest}`
      );
      i++;
      continue;
    }

    out.push(lines[i]);
    i++;
  }

  return out.join("\n");
}

export function renderPageMarkdown(
  page: PageEntry,
  lookup: Map<string, PageEntry>
): {
  html: string;
  headings: TocHeading[];
} {
  const headings: TocHeading[] = [];
  const renderer = new Renderer();

  renderer.heading = function ({ tokens, depth }) {
    const renderedInline = this.parser.parseInline(tokens);
    const plainText = decodeHtmlEntities(
      renderedInline.replace(/<[^>]+>/g, "")
    );
    const slug = slugifyHeading(plainText);
    if (depth === 2 || depth === 3) {
      headings.push({ level: depth, text: plainText, slug });
    }
    const Tag = `h${depth}`;
    if (renderedInline.includes("<a ")) {
      return `<${Tag} id="${slug}" class="group scroll-mt-20">${renderedInline} <a href="#${slug}" class="text-base-content/40 hover:text-primary ml-1.5 font-normal no-underline" aria-label="Link to section">#</a></${Tag}>\n`;
    }
    return `<${Tag} id="${slug}" class="group scroll-mt-20"><a href="#${slug}" class="heading-link">${renderedInline} <span class="text-base-content/30 group-hover:text-primary ml-1 font-normal">#</span></a></${Tag}>\n`;
  };

  renderer.table = function (token) {
    let headerHtml = "";
    for (let j = 0; j < token.header.length; j++) {
      const cell = token.header[j];
      headerHtml += `<th>${this.parser.parseInline(cell.tokens)}</th>`;
    }
    let bodyHtml = "";
    for (let r = 0; r < token.rows.length; r++) {
      const row = token.rows[r];
      let rowHtml = "";
      for (let c = 0; c < row.length; c++) {
        rowHtml += `<td>${this.parser.parseInline(row[c].tokens)}</td>`;
      }
      bodyHtml += `<tr>${rowHtml}</tr>`;
    }
    return `<div class="my-6 overflow-x-auto"><table class="table table-zebra w-full"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>\n`;
  };

  renderer.code = ({ text, lang }) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (lang === "mermaid") {
      return `<div class="my-6 rounded-lg border border-base-300 bg-base-200 p-5 overflow-x-auto not-prose"><pre class="mermaid text-center text-sm">${escaped}</pre></div>\n`;
    }

    const langHeader = lang
      ? `<div class="px-4 py-2 bg-base-300 text-xs font-mono text-base-content/70">${lang}</div>`
      : "";
    return `<div class="my-5 rounded-lg border border-base-300 bg-base-200 overflow-hidden not-prose">${langHeader}<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-base-content"><code>${escaped}</code></pre></div>\n`;
  };

  const markedInstance = new Marked({ renderer, gfm: true, breaks: false });
  const helperMarked = new Marked({ gfm: true, breaks: false });

  const withLinks = resolveWikilinksAndCitations(page.rawBody, page, lookup);
  const preprocessed = transformAlertsAndAssumptions(withLinks, helperMarked);
  const html = markedInstance.parse(preprocessed) as string;

  return { html, headings };
}
