import type { PageEntry } from "../types.js";

export function ArticleHeader(props: { page: PageEntry }) {
  const { page } = props;
  const fm = page.frontmatter;

  return (
    <div class="mb-6 pb-4 border-b border-base-300 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-mono text-base-content/75">
      <span class="badge badge-neutral font-mono font-semibold">{fm.id}</span>
      <span>·</span>
      <span>status: {fm.status}</span>
      <span>·</span>
      <span>updated {fm.date}</span>
    </div>
  );
}
