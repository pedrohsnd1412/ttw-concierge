export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className="flex flex-col items-center leading-none">
      <span className={`font-sans ${s} font-medium tracking-[0.35em] text-ivory`}>TTW</span>
      <span className="mt-1 text-[9px] uppercase tracking-luxe text-champagne/80">Concierge</span>
    </div>
  );
}

export function WordmarkInline() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-sans text-xl font-medium tracking-[0.3em] text-ivory">TTW</span>
      <span className="text-[10px] uppercase tracking-luxe text-champagne/70">Concierge</span>
    </div>
  );
}
