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
      <aside class="bg-base-200 text-base-content min-h-full w-80 border-r border-base-300 flex flex-col">
        <div class="p-4 border-b border-base-300 flex items-center justify-between lg:hidden">
          <span class="font-mono font-bold text-sm">zmem Knowledge Base</span>
          <label htmlFor="zmem-drawer" class="btn btn-ghost btn-xs">
            ✕
          </label>
        </div>

        <ul
          class="menu menu-sm p-3 gap-1.5 flex-1 overflow-y-auto"
          aria-label="Knowledge Base Navigation"
        >
          {navGroups.map((group) => (
            <li key={group.title}>
              <details open>
                <summary class="font-semibold text-xs uppercase tracking-wider text-base-content/80 py-2">
                  <span>{group.title}</span>
                  <span class="badge badge-ghost badge-xs font-mono ml-auto">
                    {group.badge}
                  </span>
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
                          class={`items-start py-1.5 ${
                            isActive ? "active font-medium" : ""
                          }`}
                        >
                          <span class="badge badge-neutral badge-xs font-mono shrink-0 mt-0.5">
                            {item.frontmatter.id}
                          </span>
                          <span class="leading-snug text-xs">
                            {item.frontmatter.title}
                          </span>
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
