export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-card-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm text-white">
            DZ
          </span>
          <span>DollyZoom</span>
        </a>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <a href="#demo" className="hover:text-foreground transition-colors">
            Demo
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
          <a
            href="#upload"
            className="rounded-full bg-accent px-3.5 py-1.5 font-medium text-white hover:bg-accent-soft transition-colors"
          >
            Try free
          </a>
        </nav>
      </div>
    </header>
  );
}
