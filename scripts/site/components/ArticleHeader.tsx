import type { PageEntry } from "../types.js";

export function ArticleHeader(props: { page: PageEntry }) {
  const { page } = props;
  const fm = page.frontmatter;

  return (
    <div class="mb-6 pb-4 border-b border-base-300 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2 text-sm font-mono">
        <span class="badge badge-neutral font-mono font-bold px-3 py-3">
          {fm.id}
        </span>
        <span class="badge badge-outline font-mono px-3 py-3">
          status: {fm.status}
        </span>
        <span class="badge badge-ghost font-mono px-3 py-3">
          updated: {fm.date}
        </span>
      </div>

      {fm.tags.length > 0 && (
        <div class="flex flex-wrap items-center gap-1.5">
          {fm.tags.map((t) => (
            <span
              key={t}
              class="text-xs font-mono px-2 py-0.5 rounded bg-base-200 border border-base-300 text-base-content/85"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
