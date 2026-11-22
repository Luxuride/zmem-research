import type { PageEntry } from "../types.js";

export function ArticleHeader(props: { page: PageEntry }) {
  const { page } = props;
  const fm = page.frontmatter;

  return (
    <div class="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-mono text-base-content/60">
      <span class="text-base-content font-semibold">{fm.id}</span>
      <span>·</span>
      <span>status: {fm.status}</span>
      <span>·</span>
      <span>updated {fm.date}</span>
    </div>
  );
}
