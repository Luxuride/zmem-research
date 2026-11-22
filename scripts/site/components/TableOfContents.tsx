import type { TocHeading } from "../types.js";

export function TableOfContents(props: { headings: TocHeading[] }) {
  const { headings } = props;
  if (headings.length === 0) {
    return null;
  }

  return (
    <aside class="hidden xl:block sticky top-16 h-[calc(100vh-4rem)] w-72 shrink-0 border-l border-base-300 px-4 py-8 overflow-y-auto">
      <ul class="menu menu-sm w-full p-0 gap-0.5">
        <li class="menu-title font-mono text-xs uppercase tracking-wider">
          On This Page
        </li>
        {headings.map((h) => (
          <li key={h.slug} class={h.level === 3 ? "pl-3" : ""}>
            <a href={`#${h.slug}`} class="text-sm leading-snug py-1.5">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
