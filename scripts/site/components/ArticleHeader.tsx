import type { PageEntry } from "../types.js";

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "accepted":
    case "active":
    case "verified":
      return "badge-success";
    case "proposed":
    case "planned":
    case "draft":
      return "badge-warning";
    default:
      return "badge-info";
  }
}

export function ArticleHeader(props: { page: PageEntry }) {
  const { page } = props;
  const fm = page.frontmatter;

  return (
    <div class="mb-8 pb-6 border-b border-base-300">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <span class="badge badge-primary font-mono font-semibold">
          {fm.id}
        </span>
        <span
          class={`badge ${statusBadgeClass(
            fm.status
          )} badge-outline font-mono`}
        >
          {fm.status}
        </span>
        <span class="badge badge-neutral font-mono">{fm.type}</span>
        <span class="badge badge-neutral font-mono">{fm.date}</span>
        <span class="badge badge-ghost font-mono text-xs">
          {page.repoRelPath}
        </span>
      </div>

      {fm.tags.length > 0 && (
        <div class="flex flex-wrap items-center gap-1.5">
          {fm.tags.map((tag) => (
            <span
              key={tag}
              class="badge badge-outline badge-sm font-mono text-base-content/70"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
