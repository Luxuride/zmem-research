import type { TocHeading } from "../types.js";

export function TableOfContents(props: { headings: TocHeading[] }) {
  const { headings } = props;
  if (headings.length === 0) {
    return null;
  }

  return (
    <aside class="hidden xl:block sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 border-l border-base-300 px-3 py-6 overflow-y-auto">
      <ul class="menu menu-xs w-full p-0">
        <li class="menu-title uppercase tracking-wider text-xs">
          On This Page
        </li>
        {headings.map((h) => (
          <li key={h.slug} class={h.level === 3 ? "pl-3" : ""}>
            <a href={`#${h.slug}`} class="leading-snug py-1">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
