/** Visualizações em SVG/CSS — leves, sem dependências externas, tema TTW. */

export function BarList({
  data, max, suffix = "",
}: {
  data: { label: string; value: number; sub?: string }[];
  max?: number;
  suffix?: string;
}) {
  const top = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-4">
          <div className="w-32 shrink-0 text-right text-sm text-ivory/85">
            {d.label}
            {d.sub && <span className="ml-1 text-xs text-muted">{d.sub}</span>}
          </div>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-gradient-to-r from-champagne-dark to-champagne-light"
              style={{ width: `${(d.value / top) * 100}%` }}
            />
          </div>
          <div className="w-14 shrink-0 text-sm tabular-nums text-champagne">
            {d.value}
            {suffix}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Heat12({ values, labels }: { values: number[]; labels: string[] }) {
  // Normaliza contra a faixa real (min–max) e não contra zero: como a sazonalidade
  // costuma ser quase plana, ancorar no zero comprimiria toda a variação numa única tonalidade.
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return (
    <div className="grid grid-cols-12 gap-1.5">
      {values.map((v, i) => {
        const a = 0.12 + 0.88 * ((v - min) / range);
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="aspect-square w-full rounded"
              style={{ background: `rgba(194,165,106,${a.toFixed(2)})` }}
              title={`${labels[i]}: ${v}`}
            />
            <span className="text-[10px] uppercase text-muted">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Radar({ data }: { data: { axis: string; value: number }[] }) {
  const size = 260, cx = size / 2, cy = size / 2, r = 92;
  const n = data.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, val: number) => {
    const rad = r * Math.max(0.04, Math.min(1, val));
    return [cx + rad * Math.cos(angle(i)), cy + rad * Math.sin(angle(i))];
  };
  const poly = data.map((d, i) => point(i, d.value).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]">
      {rings.map((rr, idx) => (
        <circle key={idx} cx={cx} cy={cy} r={r * rr} fill="none" stroke="rgba(194,165,106,0.12)" />
      ))}
      {data.map((d, i) => {
        const [x, y] = point(i, 1);
        const [lx, ly] = [cx + (r + 22) * Math.cos(angle(i)), cy + (r + 22) * Math.sin(angle(i))];
        return (
          <g key={d.axis}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(194,165,106,0.1)" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              className="fill-current text-[8px]" style={{ fill: "#9A958C" }}>
              {d.axis}
            </text>
          </g>
        );
      })}
      <polygon points={poly} fill="rgba(194,165,106,0.22)" stroke="#C2A56A" strokeWidth={1.5} />
      {data.map((d, i) => {
        const [x, y] = point(i, d.value);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="#D8C18E" />;
      })}
    </svg>
  );
}
