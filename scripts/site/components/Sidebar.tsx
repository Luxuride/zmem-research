import { computeRelativeHref } from "../discovery.js";
import type { NavGroup, PageEntry } from "../types.js";

export function Sidebar(props: {
  currentPage: PageEntry;
  navGroups: NavGroup[];
  homeHref: string;
}) {
  const { currentPage, navGroups, homeHref } = props;

  return (
    <div class="drawer-side z-40">
      <label
        htmlFor="zmem-drawer"
        aria-label="close sidebar"
        class="drawer-overlay"
      />
      <aside class="bg-base-200 text-base-content w-80 h-full overflow-y-auto border-r border-base-300">
        <div class="h-16 px-5 border-b border-base-300 flex items-center justify-between">
          <a
            href={homeHref}
            class="font-mono font-bold text-base text-base-content hover:text-primary transition-colors"
          >
            zmem <span class="text-base-content/60 font-normal">/ research</span>
          </a>
          <label
            htmlFor="zmem-drawer"
            class="btn btn-ghost btn-sm lg:hidden"
            aria-label="Close navigation"
          >
            ✕
          </label>
        </div>

        <ul
          class="menu menu-md px-3 py-4 gap-1 w-full"
          aria-label="Knowledge Base Navigation"
        >
          {navGroups.map((group) => (
            <li key={group.title}>
              <details open>
                <summary class="font-mono text-xs font-bold uppercase tracking-wider text-base-content/80">
                  {group.title}
                </summary>
                <ul class="mt-1 space-y-0.5">
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
                          class={`text-sm leading-snug py-2 ${
                            isActive
                              ? "active font-semibold border-l-2 border-primary"
                              : ""
                          }`}
                        >
                          {item.frontmatter.title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
