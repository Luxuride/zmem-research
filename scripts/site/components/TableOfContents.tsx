import type { TocHeading } from "../types.js";

export function TableOfContents(props: { headings: TocHeading[] }) {
  const { headings } = props;
  if (headings.length === 0) {
    return null;
  }

  return (
    <aside class="hidden xl:block sticky top-16 h-[calc(100vh-4rem)] w-72 shrink-0 border-l border-base-300 bg-base-200/30 px-5 py-8 overflow-y-auto">
      <div class="font-mono text-xs font-bold uppercase tracking-wider text-base-content mb-3 pb-2 border-b border-base-300">
        On This Page ({headings.length})
      </div>
      <nav aria-label="On this page">
        <ul class="space-y-1.5 text-sm">
          {headings.map((h) => (
            <li
              key={h.slug}
              class={
                h.level === 3
                  ? "ml-2.5 pl-3 border-l-2 border-base-300"
                  : "pt-1"
              }
            >
              <a
                href={`#${h.slug}`}
                class={`block leading-snug py-1 rounded px-1.5 hover:bg-base-200 transition-colors ${
                  h.level === 2
                    ? "font-semibold text-base-content"
                    : "text-base-content/85"
                }`}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
