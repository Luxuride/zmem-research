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
    <html lang="en" data-theme="night" class="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${fm.title} — zmem Research Knowledge Base`}</title>
        <link rel="stylesheet" href={cssHref} />
      </head>
      <body class="bg-base-100 text-base-content antialiased min-h-screen">
        {/* DaisyUI CSS-only responsive drawer */}
        <div class="drawer lg:drawer-open">
          <input id="zmem-drawer" type="checkbox" class="drawer-toggle" />

          <div class="drawer-content flex flex-col min-h-screen">
            <Header homeHref={homeHref} />

            <div class="flex-1 flex justify-between max-w-[1400px] w-full mx-auto">
              <main class="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-8 max-w-4xl">
                <ArticleHeader page={page} />

                <article
                  class="prose max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:underline prose-code:bg-base-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:text-xs prose-th:bg-base-200 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2"
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

        {page.htmlBody?.includes('class="mermaid') && (
          <script
            type="module"
            dangerouslySetInnerHTML={{
              __html: `
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: true, theme: 'dark' });
`,
            }}
          />
        )}
      </body>
    </html>
  );
}
