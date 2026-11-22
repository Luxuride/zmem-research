export function Header(props: { homeHref: string; repoRelPath: string }) {
  const { homeHref, repoRelPath } = props;

  return (
    <header class="navbar sticky top-0 z-30 h-16 min-h-16 bg-base-100/95 backdrop-blur border-b border-base-300 px-4 lg:px-8">
      <div class="navbar-start gap-3 w-auto flex-1">
        <label
          htmlFor="zmem-drawer"
          class="btn btn-square btn-ghost btn-sm drawer-button lg:hidden"
          title="Toggle Navigation"
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

        <a
          href={homeHref}
          class="font-mono text-lg font-bold tracking-tight text-base-content hover:text-primary transition-colors"
        >
          zmem <span class="text-base-content/50 font-normal">/ research</span>
        </a>

        <span class="hidden sm:inline-block text-sm font-mono text-base-content/60 border-l border-base-300 pl-3">
          {repoRelPath}
        </span>
      </div>

      <div class="navbar-end w-auto">
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
