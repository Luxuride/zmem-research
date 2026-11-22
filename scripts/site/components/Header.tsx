import { computeRelativeHref } from "../discovery.js";
import type { PageEntry } from "../types.js";

const TOP_NAV_LINKS = [
  { label: "Home", targetHtml: "index.html" },
  { label: "Master Index", targetHtml: "INDEX.html" },
  {
    label: "Research",
    targetHtml: "research/01-linux-mm-and-zram-internals.html",
  },
  {
    label: "Architecture",
    targetHtml: "architecture/overview-and-dataflow.html",
  },
  { label: "ADRs", targetHtml: "adr/001-rust-blk-mq-entry-point.html" },
  { label: "Citations", targetHtml: "citations/sources.html" },
  { label: "Glossary", targetHtml: "GLOSSARY.html" },
];

export function Header(props: { currentPage: PageEntry; homeHref: string }) {
  const { currentPage, homeHref } = props;

  return (
    <header class="navbar sticky top-0 z-30 h-16 min-h-16 bg-base-100 border-b border-base-300 px-4 lg:px-8">
      <div class="navbar-start gap-2 w-auto flex-1">
        <label
          htmlFor="zmem-drawer"
          class="btn btn-square btn-ghost btn-sm drawer-button lg:hidden"
          title="Open Navigation Drawer"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </label>

        {/* Breadcrumb trail */}
        <div class="breadcrumbs text-sm py-0">
          <ul>
            <li>
              <a href={homeHref} class="font-mono font-bold text-base-content">
                zmem
              </a>
            </li>
            <li class="font-mono text-base-content/80">
              {currentPage.repoRelPath}
            </li>
          </ul>
        </div>
      </div>

      {/* Top quick-jump navigation links */}
      <div class="navbar-center hidden md:flex">
        <ul class="menu menu-horizontal px-1 gap-1 text-sm font-medium">
          {TOP_NAV_LINKS.map((item) => {
            const href = computeRelativeHref(
              currentPage.outRelHtmlPath,
              item.targetHtml
            );
            const isSectionActive =
              currentPage.outRelHtmlPath === item.targetHtml ||
              (item.label === "Research" &&
                currentPage.outRelHtmlPath.startsWith("research/")) ||
              (item.label === "Architecture" &&
                currentPage.outRelHtmlPath.startsWith("architecture/")) ||
              (item.label === "ADRs" &&
                currentPage.outRelHtmlPath.startsWith("adr/")) ||
              (item.label === "Citations" &&
                currentPage.outRelHtmlPath.startsWith("citations/"));

            return (
              <li key={item.label}>
                <a
                  href={href}
                  class={
                    isSectionActive
                      ? "bg-base-200 text-base-content font-semibold border border-base-300"
                      : "text-base-content/85 hover:text-base-content"
                  }
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div class="navbar-end gap-2 w-auto">
        <a
          href="https://github.com/Luxuride/zmem-research"
          class="btn btn-ghost btn-sm font-mono text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </div>
    </header>
  );
}
