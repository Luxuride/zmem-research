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

@layer base {
  details > summary::-webkit-details-marker {
    display: none;
  }

  body {
    font-size: 16px;
    line-height: 1.7;
  }
}

/* Readable, full-width academic & systems documentation typography */
.doc-prose {
  font-size: 1rem;
  line-height: 1.75;
  color: oklch(var(--bc) / 0.92);
}

.doc-prose h1 {
  font-size: 2rem;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: oklch(var(--bc));
  margin-top: 0;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid oklch(var(--b3));
}

.doc-prose h2 {
  font-size: 1.45rem;
  line-height: 1.35;
  font-weight: 650;
  letter-spacing: -0.015em;
  color: oklch(var(--bc));
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid oklch(var(--b3));
}

.doc-prose h3 {
  font-size: 1.2rem;
  line-height: 1.4;
  font-weight: 600;
  color: oklch(var(--bc));
  margin-top: 1.85rem;
  margin-bottom: 0.75rem;
}

.doc-prose h4 {
  font-size: 1.05rem;
  line-height: 1.45;
  font-weight: 600;
  color: oklch(var(--bc));
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.doc-prose h1 a.heading-link,
.doc-prose h2 a.heading-link,
.doc-prose h3 a.heading-link,
.doc-prose h4 a.heading-link {
  color: inherit;
  text-decoration: none;
}

.doc-prose h1 a.heading-link:hover,
.doc-prose h2 a.heading-link:hover,
.doc-prose h3 a.heading-link:hover,
.doc-prose h4 a.heading-link:hover {
  color: oklch(var(--p));
}

.doc-prose p {
  margin-top: 0.85rem;
  margin-bottom: 0.85rem;
}

.doc-prose ul,
.doc-prose ol {
  margin-top: 0.75rem;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.doc-prose ul {
  list-style-type: disc;
}

.doc-prose ol {
  list-style-type: decimal;
}

.doc-prose li {
  margin-top: 0.35rem;
  margin-bottom: 0.35rem;
}

.doc-prose li > ul,
.doc-prose li > ol {
  margin-top: 0.3rem;
  margin-bottom: 0.3rem;
}

.doc-prose strong {
  font-weight: 650;
  color: oklch(var(--bc));
}

.doc-prose a {
  color: oklch(var(--p));
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: oklch(var(--p) / 0.4);
}

.doc-prose a:hover {
  text-decoration-color: oklch(var(--p));
}

.doc-prose code:not(pre code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  background-color: oklch(var(--b2));
  color: oklch(var(--bc));
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  border: 1px solid oklch(var(--b3));
}

.doc-prose hr {
  margin: 2.25rem 0;
  border-color: oklch(var(--b3));
}

.doc-prose table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 1.5rem 0;
  border: 1px solid oklch(var(--b3));
}

.doc-prose thead th {
  background-color: oklch(var(--b2));
  color: oklch(var(--bc));
  font-weight: 600;
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid oklch(var(--b3));
  border-right: 1px solid oklch(var(--b3) / 0.7);
}

.doc-prose tbody td {
  padding: 0.75rem 1rem;
  vertical-align: top;
  border-bottom: 1px solid oklch(var(--b3) / 0.8);
  border-right: 1px solid oklch(var(--b3) / 0.6);
}

.doc-prose tbody tr:nth-child(even) {
  background-color: oklch(var(--b2) / 0.4);
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
