import type { TocHeading } from "../types.js";

export function TableOfContents(props: { headings: TocHeading[] }) {
  const { headings } = props;
  if (headings.length === 0) {
    return null;
  }

  return (
    <aside class="hidden xl:block sticky top-13 h-[calc(100vh-3.25rem)] w-64 shrink-0 border-l border-base-300 px-5 py-8 overflow-y-auto">
      <div class="text-xs font-mono font-bold uppercase tracking-wider text-base-content/60 mb-3">
        On This Page
      </div>
      <ul class="space-y-2 text-sm border-l border-base-300 pl-3">
        {headings.map((h) => (
          <li key={h.slug} class={h.level === 3 ? "pl-3" : ""}>
            <a
              href={`#${h.slug}`}
              class="block text-base-content/70 hover:text-primary leading-snug py-0.5 transition-colors"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
