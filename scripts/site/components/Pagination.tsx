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
          class="card card-compact bg-base-200 hover:bg-base-300 border border-base-300 transition-colors"
        >
          <div class="card-body">
            <div class="text-xs font-mono text-base-content/60">
              ← Previous ({prevPage.frontmatter.id})
            </div>
            <div class="text-sm font-semibold text-base-content">
              {prevPage.frontmatter.title}
            </div>
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
          class="card card-compact bg-base-200 hover:bg-base-300 border border-base-300 text-right transition-colors"
        >
          <div class="card-body items-end">
            <div class="text-xs font-mono text-base-content/60">
              Next ({nextPage.frontmatter.id}) →
            </div>
            <div class="text-sm font-semibold text-base-content">
              {nextPage.frontmatter.title}
            </div>
          </div>
        </a>
      ) : (
        <div />
      )}
    </div>
  );
}
