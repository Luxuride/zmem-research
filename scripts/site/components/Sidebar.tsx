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
      <aside class="bg-base-200 text-base-content w-80 h-full overflow-y-auto border-r border-base-300">
        <div class="h-16 px-4 border-b border-base-300 flex items-center justify-between lg:hidden">
          <span class="font-mono font-bold text-base">zmem / research</span>
          <label htmlFor="zmem-drawer" class="btn btn-ghost btn-sm">
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
                <summary class="font-mono text-xs font-bold uppercase tracking-wider text-base-content/65">
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
                            isActive ? "active font-semibold" : ""
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
