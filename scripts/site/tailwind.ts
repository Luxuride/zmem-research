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

/* Bind @tailwindcss/typography (.prose) to DaisyUI semantic theme variables
   so light and dark modes (prefers-color-scheme) have proper contrast and rhythm */
.prose {
  --tw-prose-body: oklch(var(--bc) / 0.9);
  --tw-prose-headings: oklch(var(--bc));
  --tw-prose-lead: oklch(var(--bc) / 0.85);
  --tw-prose-links: oklch(var(--p));
  --tw-prose-bold: oklch(var(--bc));
  --tw-prose-counters: oklch(var(--bc) / 0.7);
  --tw-prose-bullets: oklch(var(--bc) / 0.6);
  --tw-prose-hr: oklch(var(--b3));
  --tw-prose-quotes: oklch(var(--bc) / 0.85);
  --tw-prose-quote-borders: oklch(var(--p));
  --tw-prose-captions: oklch(var(--bc) / 0.7);
  --tw-prose-code: oklch(var(--bc));
  --tw-prose-pre-code: oklch(var(--bc));
  --tw-prose-pre-bg: oklch(var(--b2));
  --tw-prose-th-borders: oklch(var(--b3));
  --tw-prose-td-borders: oklch(var(--b3));
  font-size: 1rem;
  line-height: 1.75;
}

.prose :where(code):not(:where([class~="not-prose"], [class~="not-prose"] *, pre *)) {
  background-color: oklch(var(--b2));
  border: 1px solid oklch(var(--b3));
  border-radius: 0.3rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.875em;
  font-weight: 500;
}

.prose :where(code):not(:where([class~="not-prose"], [class~="not-prose"] *))::before,
.prose :where(code):not(:where([class~="not-prose"], [class~="not-prose"] *))::after {
  content: none;
}

.prose :where(h1, h2, h3, h4) a.heading-link {
  color: inherit;
  text-decoration: none;
  font-weight: inherit;
}

.prose :where(h1, h2, h3, h4) a.heading-link:hover {
  color: oklch(var(--p));
}

.prose :where(h2) {
  padding-bottom: 0.4rem;
  border-bottom: 1px solid oklch(var(--b3));
}

.prose :where(table) {
  font-size: 0.9375rem;
  line-height: 1.6;
  border: 1px solid oklch(var(--b3));
}

.prose :where(thead th) {
  background-color: oklch(var(--b2));
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.prose :where(tbody td) {
  padding: 0.75rem 1rem;
  vertical-align: top;
}

.prose :where(tbody tr:nth-child(even)) {
  background-color: oklch(var(--b2) / 0.35);
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
