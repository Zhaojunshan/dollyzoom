export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Updated {updated}</p>
      <div className="mt-8 space-y-4 text-sm leading-7 text-foreground [&_a]:underline [&_a]:decoration-accent/50 [&_a]:underline-offset-4 [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
