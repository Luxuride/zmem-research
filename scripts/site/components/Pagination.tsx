import { computeRelativeHref } from "../discovery.js";
import type { PageEntry } from "../types.js";

export function Pagination(props: {
  currentPage: PageEntry;
  prevPage?: PageEntry;
  nextPage?: PageEntry;
}) {
  const { currentPage, prevPage, nextPage } = props;

  return (
    <div class="mt-14 pt-6 border-t border-base-300 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {prevPage ? (
        <a
          href={computeRelativeHref(
            currentPage.outRelHtmlPath,
            prevPage.outRelHtmlPath
          )}
          class="group rounded border border-base-300 bg-base-200/50 hover:border-primary/50 px-5 py-4 transition-colors"
        >
          <div class="text-xs font-mono text-base-content/60 mb-1">
            ← {prevPage.frontmatter.id}
          </div>
          <div class="text-sm font-semibold text-base-content group-hover:text-primary">
            {prevPage.frontmatter.title}
          </div>
        </a>
      ) : (
        <div />
      )}

      {nextPage ? (
        <a
          href={computeRelativeHref(
            currentPage.outRelHtmlPath,
            nextPage.outRelHtmlPath
          )}
          class="group rounded border border-base-300 bg-base-200/50 hover:border-primary/50 px-5 py-4 text-right transition-colors"
        >
          <div class="text-xs font-mono text-base-content/60 mb-1">
            {nextPage.frontmatter.id} →
          </div>
          <div class="text-sm font-semibold text-base-content group-hover:text-primary">
            {nextPage.frontmatter.title}
          </div>
        </a>
      ) : (
        <div />
      )}
    </div>
  );
}
