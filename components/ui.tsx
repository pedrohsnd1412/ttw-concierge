export function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="fadeup">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 font-serif text-4xl text-ivory lg:text-5xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
      <div className="mt-6 h-px w-24 bg-champagne/50" />
    </header>
  );
}

export function PageShell({
  header,
  pinned,
  contained = false,
  children,
}: {
  header: React.ReactNode;
  pinned?: React.ReactNode;
  contained?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div data-page-pinned className="shrink-0">{header}</div>
      <div
        data-page-scroll
        className={`mt-5 pb-8 lg:min-h-0 lg:flex-1 lg:pr-4 ${
          contained
            ? "lg:overflow-hidden"
            : "lg:overflow-y-auto lg:overscroll-contain"
        }`}
      >
        {pinned && <div className="mb-10">{pinned}</div>}
        {children}
      </div>
    </div>
  );
}

export function Kpi({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="card p-6">
      <p className="font-serif text-4xl text-champagne">{value}</p>
      <p className="mt-1 text-sm text-ivory/80">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <h2 className="font-serif text-2xl text-ivory">{children}</h2>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}
