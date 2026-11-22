import type { NavGroup, PageEntry } from "../types.js";
import { ArticleHeader } from "./ArticleHeader.js";
import { Header } from "./Header.js";
import { Pagination } from "./Pagination.js";
import { Sidebar } from "./Sidebar.js";
import { TableOfContents } from "./TableOfContents.js";

export function PageLayout(props: {
  page: PageEntry;
  navGroups: NavGroup[];
  prevPage?: PageEntry;
  nextPage?: PageEntry;
  cssHref: string;
  homeHref: string;
}) {
  const { page, navGroups, prevPage, nextPage, cssHref, homeHref } = props;
  const fm = page.frontmatter;

  return (
    <html lang="en" class="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${fm.title} — zmem Research`}</title>
        <link rel="stylesheet" href={cssHref} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
        />
      </head>
      <body class="bg-base-100 text-base-content antialiased min-h-screen">
        <div class="drawer lg:drawer-open">
          <input id="zmem-drawer" type="checkbox" class="drawer-toggle" />

          <div class="drawer-content flex flex-col min-h-screen w-full">
            <Header homeHref={homeHref} repoRelPath={page.repoRelPath} />

            <div class="flex-1 flex w-full">
              <main class="flex-1 min-w-0 w-full px-6 sm:px-10 lg:px-14 py-8">
                <ArticleHeader page={page} />

                <article
                  class="doc-prose"
                  dangerouslySetInnerHTML={{ __html: page.htmlBody ?? "" }}
                />

                <Pagination
                  currentPage={page}
                  prevPage={prevPage}
                  nextPage={nextPage}
                />
              </main>

              <TableOfContents headings={page.headings} />
            </div>
          </div>

          <Sidebar currentPage={page} navGroups={navGroups} />
        </div>

        {/* Render LaTeX math formulas via KaTeX */}
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
        />
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
document.addEventListener("DOMContentLoaded", function() {
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  }
});
`,
          }}
        />

        {page.htmlBody?.includes('class="mermaid') && (
          <script
            type="module"
            dangerouslySetInnerHTML={{
              __html: `
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
mermaid.initialize({ startOnLoad: true, theme: isDark ? 'dark' : 'default' });
`,
            }}
          />
        )}
      </body>
    </html>
  );
}
