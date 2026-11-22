import { computeRelativeHref } from "../discovery.js";
import type { NavGroup, PageEntry } from "../types.js";

export function Sidebar(props: {
  currentPage: PageEntry;
  navGroups: NavGroup[];
}) {
  const { currentPage, navGroups } = props;

  return (
    <div class="drawer-side z-40">
      <label
        htmlFor="zmem-drawer"
        aria-label="close sidebar"
        class="drawer-overlay"
      />
      <aside class="bg-base-200 text-base-content min-h-full w-72 border-r border-base-300 flex flex-col">
        <div class="h-13 px-4 border-b border-base-300 flex items-center justify-between lg:hidden">
          <span class="font-mono font-semibold text-sm">zmem / research</span>
          <label htmlFor="zmem-drawer" class="btn btn-ghost btn-sm">
            ✕
          </label>
        </div>

        <nav
          class="p-4 space-y-5 flex-1 overflow-y-auto"
          aria-label="Knowledge Base Navigation"
        >
          {navGroups.map((group) => (
            <details key={group.title} open class="group/sec">
              <summary class="flex items-center justify-between px-2 py-1.5 cursor-pointer select-none text-xs font-mono font-bold uppercase tracking-wider text-base-content/60 hover:text-base-content list-none">
                <span>{group.title}</span>
                <svg
                  class="w-3.5 h-3.5 text-base-content/50 transition-transform duration-150 group-open/sec:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </summary>

              <ul class="mt-1 space-y-1 border-l border-base-300 ml-2 pl-2.5">
                {group.items.map((item) => {
                  const isActive =
                    item.outRelHtmlPath === currentPage.outRelHtmlPath;
                  const href = computeRelativeHref(
                    currentPage.outRelHtmlPath,
                    item.outRelHtmlPath
                  );
                  return (
                    <li key={item.outRelHtmlPath}>
                      <a
                        href={href}
                        class={`block rounded px-2.5 py-1.5 text-sm leading-snug transition-colors ${
                          isActive
                            ? "bg-primary/15 text-primary font-semibold"
                            : "text-base-content/80 hover:text-base-content hover:bg-base-300/50"
                        }`}
                      >
                        {item.frontmatter.title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </nav>
      </aside>
    </div>
  );
}
