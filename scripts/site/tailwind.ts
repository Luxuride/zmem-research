import * as path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import typography from "@tailwindcss/typography";
import daisyui from "daisyui";
import daisyThemes from "daisyui/src/theming/themes.js";

export async function compileTailwindCss(
  repoRoot: string,
  distRoot: string
): Promise<string> {
  const inputCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Bind @tailwindcss/typography (.prose) directly to DaisyUI's high-contrast theme variables */
.prose {
  --tw-prose-body: oklch(var(--bc));
  --tw-prose-headings: oklch(var(--bc));
  --tw-prose-lead: oklch(var(--bc));
  --tw-prose-links: oklch(var(--p));
  --tw-prose-bold: oklch(var(--bc));
  --tw-prose-counters: oklch(var(--bc));
  --tw-prose-bullets: oklch(var(--bc));
  --tw-prose-hr: oklch(var(--b3));
  --tw-prose-quotes: oklch(var(--bc));
  --tw-prose-quote-borders: oklch(var(--p));
  --tw-prose-captions: oklch(var(--bc));
  --tw-prose-code: oklch(var(--bc));
  --tw-prose-pre-code: oklch(var(--bc));
  --tw-prose-pre-bg: oklch(var(--b2));
  --tw-prose-th-borders: oklch(var(--b3));
  --tw-prose-td-borders: oklch(var(--b3));
  color: oklch(var(--bc));
  font-size: 1rem;
  line-height: 1.75;
}

.prose :where(p, li, td, th, strong, h1, h2, h3, h4) {
  color: oklch(var(--bc));
}

.prose :where(a):not(:where([class~="not-prose"], [class~="not-prose"] *)) {
  color: oklch(var(--p));
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.prose :where(code):not(:where([class~="not-prose"], [class~="not-prose"] *, pre *)) {
  background-color: oklch(var(--b2));
  color: oklch(var(--bc));
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
  color: oklch(var(--bc));
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
  color: oklch(var(--bc));
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 2px solid oklch(var(--b3));
}

.prose :where(tbody td) {
  color: oklch(var(--bc));
  padding: 0.75rem 1rem;
  vertical-align: top;
  border-bottom: 1px solid oklch(var(--b3));
}

.prose :where(tbody tr:nth-child(even)) {
  background-color: oklch(var(--b2) / 0.55);
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
        themes: [
          {
            light: {
              ...daisyThemes["light"],
              primary: "#1d4ed8",
              "primary-content": "#ffffff",
              "base-100": "#ffffff",
              "base-200": "#f3f5f8",
              "base-300": "#d0d7de",
              "base-content": "#0f172a",
            },
            dark: {
              ...daisyThemes["dark"],
              primary: "#60a5fa",
              "primary-content": "#08101d",
              "base-100": "#0b0e14",
              "base-200": "#131822",
              "base-300": "#2a3241",
              "base-content": "#f3f6fa",
            },
          },
        ],
        darkTheme: "dark",
        logs: false,
      },
    } as Parameters<typeof tailwindcss>[0]),
  ]).process(inputCss, { from: undefined });

  return result.css;
}
