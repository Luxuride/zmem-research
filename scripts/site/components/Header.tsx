export function Header(props: { homeHref: string }) {
  const { homeHref } = props;

  return (
    <header class="navbar sticky top-0 z-30 min-h-14 h-14 bg-base-100/90 backdrop-blur border-b border-base-300 px-4">
      <div class="navbar-start gap-2 w-auto flex-1">
        <label
          htmlFor="zmem-drawer"
          class="btn btn-square btn-ghost btn-sm drawer-button lg:hidden"
          title="Toggle Navigation Sidebar"
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
          class="btn btn-ghost btn-sm px-2 gap-2.5 normal-case text-base font-bold"
        >
          <span class="badge badge-primary font-mono font-bold">zm</span>
          <span class="font-mono">zmem</span>
          <span class="hidden sm:inline-block text-xs font-normal text-base-content/60 border-l border-base-300 pl-2.5">
            Rust-for-Linux Transient Memory Compression Research
          </span>
        </a>
      </div>

      <div class="navbar-end gap-3 w-auto">
        <span class="hidden md:inline-flex badge badge-success badge-outline badge-sm gap-1.5 font-mono py-2.5">
          <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
          Obsidian Vault + Citations Verified
        </span>

        {/* Zero-JS DaisyUI Theme Controller (night <-> winter) */}
        <label
          class="swap swap-rotate btn btn-ghost btn-circle btn-sm"
          title="Toggle Dark / Light Theme"
        >
          <input type="checkbox" class="theme-controller" value="winter" />
          {/* Sun icon when in dark theme */}
          <svg
            class="swap-off h-4 w-4 fill-current"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
          </svg>
          {/* Moon icon when switched to light theme */}
          <svg
            class="swap-on h-4 w-4 fill-current"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
          </svg>
        </label>
      </div>
    </header>
  );
}
