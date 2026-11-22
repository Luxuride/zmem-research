export function Header(props: { homeHref: string; repoRelPath: string }) {
  const { homeHref, repoRelPath } = props;

  return (
    <header class="sticky top-0 z-30 h-13 bg-base-100/95 backdrop-blur border-b border-base-300 px-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
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
              strokeWidth={1.75}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </label>

        <a
          href={homeHref}
          class="font-mono text-base font-bold tracking-tight text-base-content hover:text-primary transition-colors"
        >
          zmem <span class="text-base-content/50 font-normal">/ research</span>
        </a>

        <span class="hidden sm:inline-block text-sm font-mono text-base-content/55 border-l border-base-300 pl-3">
          {repoRelPath}
        </span>
      </div>

      <div class="flex items-center gap-4">
        <a
          href="https://github.com/Luxuride/zmem-research"
          class="text-sm font-mono text-base-content/65 hover:text-base-content transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
