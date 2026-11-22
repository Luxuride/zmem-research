import { computeRelativeHref } from "../discovery.js";
import type { NavGroup, PageEntry } from "../types.js";

function shortBadgeLabel(page: PageEntry): string {
  const id = page.frontmatter.id;
  if (id.startsWith("RES-")) return id.replace("RES-", "Ch.");
  if (id.startsWith("ARCH-")) return "Spec";
  if (id.startsWith("ADR-")) return id;
  return id;
}

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
      <aside class="bg-base-200 text-base-content w-80 h-full overflow-y-auto border-r border-base-300 flex flex-col">
        {/* Top brand bar aligned with 64px (h-16) navbar */}
        <div class="h-16 min-h-16 px-5 border-b border-base-300 flex items-center justify-between bg-base-200 sticky top-0 z-10">
          <a
            href={homeHref}
            class="flex items-center gap-2.5 font-mono font-bold text-base text-base-content hover:opacity-80"
          >
            <span>zmem / research</span>
          </a>
          <label
            htmlFor="zmem-drawer"
            class="btn btn-ghost btn-sm lg:hidden"
            aria-label="Close navigation"
          >
            ✕
          </label>
        </div>

        <nav
          class="p-3 space-y-3 flex-1"
          aria-label="Knowledge Base Navigation"
        >
          {navGroups.map((group) => (
            <details
              key={group.title}
              open
              class="group/nav rounded-lg border border-base-300 bg-base-100 overflow-hidden"
            >
              <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none bg-base-200/60 hover:bg-base-300/50 transition-colors list-none">
                <span class="font-mono text-xs font-bold uppercase tracking-wider text-base-content">
                  {group.title}
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="badge badge-sm badge-neutral font-mono">
                    {group.badge}
                  </span>
                  <svg
                    class="w-3.5 h-3.5 text-base-content/70 transition-transform duration-150 group-open/nav:rotate-90"
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
                </span>
              </summary>

              <ul class="p-1.5 space-y-1 border-t border-base-300">
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
                        aria-current={isActive ? "page" : undefined}
                        class={`flex items-start gap-2.5 rounded-md px-2.5 py-2 text-sm leading-snug transition-colors ${
                          isActive
                            ? "bg-primary text-primary-content font-semibold shadow-xs"
                            : "text-base-content hover:bg-base-200"
                        }`}
                      >
                        <span
                          class={`font-mono text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                            isActive
                              ? "bg-primary-content/20 text-primary-content font-bold"
                              : "bg-base-200 text-base-content/80 border border-base-300"
                          }`}
                        >
                          {shortBadgeLabel(item)}
                        </span>
                        <span>{item.frontmatter.title}</span>
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
