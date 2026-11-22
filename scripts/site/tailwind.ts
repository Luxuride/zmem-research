import * as path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import typography from "@tailwindcss/typography";
import daisyui from "daisyui";

export async function compileTailwindCss(
  repoRoot: string,
  distRoot: string
): Promise<string> {
  const inputCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* High-contrast, high-legibility light & dark documentation theme tokens
   (GitHub Docs / MDN WCAG AAA contrast standards) */
:root,
[data-theme="light"] {
  --doc-bg: #ffffff;
  --doc-surface: #f6f8fa;
  --doc-surface-2: #eaeef2;
  --doc-border: #d0d7de;
  --doc-text: #1f2328;
  --doc-text-muted: #59636e;
  --doc-link: #0969da;
  --doc-link-hover: #0550ae;
  --doc-code-bg: #eff2f5;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --doc-bg: #0d1117;
    --doc-surface: #161b22;
    --doc-surface-2: #21262d;
    --doc-border: #30363d;
    --doc-text: #e6edf3;
    --doc-text-muted: #9198a1;
    --doc-link: #58a6ff;
    --doc-link-hover: #79c0ff;
    --doc-code-bg: #1f242d;
  }
}

[data-theme="dark"] {
  --doc-bg: #0d1117;
  --doc-surface: #161b22;
  --doc-surface-2: #21262d;
  --doc-border: #30363d;
  --doc-text: #e6edf3;
  --doc-text-muted: #9198a1;
  --doc-link: #58a6ff;
  --doc-link-hover: #79c0ff;
  --doc-code-bg: #1f242d;
}

body {
  background-color: var(--doc-bg);
  color: var(--doc-text);
  font-size: 16px;
  line-height: 1.75;
}

.prose {
  --tw-prose-body: var(--doc-text);
  --tw-prose-headings: var(--doc-text);
  --tw-prose-lead: var(--doc-text);
  --tw-prose-links: var(--doc-link);
  --tw-prose-bold: var(--doc-text);
  --tw-prose-counters: var(--doc-text-muted);
  --tw-prose-bullets: var(--doc-text-muted);
  --tw-prose-hr: var(--doc-border);
  --tw-prose-quotes: var(--doc-text);
  --tw-prose-quote-borders: var(--doc-link);
  --tw-prose-captions: var(--doc-text-muted);
  --tw-prose-code: var(--doc-text);
  --tw-prose-pre-code: var(--doc-text);
  --tw-prose-pre-bg: var(--doc-surface);
  --tw-prose-th-borders: var(--doc-border);
  --tw-prose-td-borders: var(--doc-border);
  color: var(--doc-text);
  font-size: 1.025rem;
  line-height: 1.78;
}

/* Optimal reading measure (~82ch) for paragraphs & lists, while tables & diagrams span full width */
.prose > p,
.prose > ul,
.prose > ol,
.prose > blockquote,
.prose > div[role="note"] {
  max-width: 85ch;
}

.prose :where(a):not(:where([class~="not-prose"], [class~="not-prose"] *)) {
  color: var(--doc-link);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.prose :where(a):not(:where([class~="not-prose"], [class~="not-prose"] *)):hover {
  color: var(--doc-link-hover);
}

.prose :where(code):not(:where([class~="not-prose"], [class~="not-prose"] *, pre *)) {
  background-color: var(--doc-code-bg);
  color: var(--doc-text);
  border: 1px solid var(--doc-border);
  border-radius: 0.3rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.88em;
  font-weight: 500;
}

.prose :where(code):not(:where([class~="not-prose"], [class~="not-prose"] *))::before,
.prose :where(code):not(:where([class~="not-prose"], [class~="not-prose"] *))::after {
  content: none;
}

.prose :where(h1, h2, h3, h4) a.heading-link {
  color: var(--doc-text);
  text-decoration: none;
  font-weight: inherit;
}

.prose :where(h1, h2, h3, h4) a.heading-link:hover {
  color: var(--doc-link);
}

.prose :where(h1) {
  font-size: 2rem;
  line-height: 1.25;
  letter-spacing: -0.02em;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--doc-border);
}

.prose :where(h2) {
  font-size: 1.5rem;
  line-height: 1.35;
  letter-spacing: -0.015em;
  margin-top: 2.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--doc-border);
}

.prose :where(h3) {
  font-size: 1.225rem;
  line-height: 1.4;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}

.prose :where(table) {
  width: 100%;
  font-size: 0.9375rem;
  line-height: 1.6;
  border: 1px solid var(--doc-border);
  border-collapse: collapse;
}

.prose :where(thead th) {
  background-color: var(--doc-surface);
  color: var(--doc-text);
  padding: 0.8rem 1rem;
  font-weight: 600;
  border-bottom: 2px solid var(--doc-border);
  border-right: 1px solid var(--doc-border);
}

.prose :where(tbody td) {
  color: var(--doc-text);
  padding: 0.8rem 1rem;
  vertical-align: top;
  border-bottom: 1px solid var(--doc-border);
  border-right: 1px solid var(--doc-border);
}

.prose :where(tbody tr:nth-child(even)) {
  background-color: var(--doc-surface);
}
`;

  const result = await postcss([
    tailwindcss({
      content: [
        path.join(repoRoot, "scripts/site/**/*.ts"),
        path.join(repoRoot, "scripts/site/**/*.tsx"),
        path.join(distRoot, "**/*.html"),
      ],
      theme: {
        extend: {},
      },
      plugins: [typography, daisyui],
      daisyui: {
        themes: ["light", "dark"],
        darkTheme: "dark",
        logs: false,
      },
    } as Parameters<typeof tailwindcss>[0]),
  ]).process(inputCss, { from: undefined });

  return result.css;
}
