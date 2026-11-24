import { formatMoney, formatTime } from "@/lib/format.mjs";

type Point = { time: string; value: number };
type Series = { id: string; label: string; color: string; points: Point[] };

export function SeriesChart({
  title,
  description,
  series,
  currency,
  timeZone,
  empty,
}: {
  title: string;
  description: string;
  series: Series[];
  currency: string | null;
  timeZone: string | null;
  empty: string;
}) {
  const usable = series.filter((item) => item.points.length > 0);
  const points = usable.flatMap((item) => item.points);
  const titleId = `chart-${title}`;

  if (points.length < 2) {
    return (
      <figure className="rounded-2xl border border-dashed border-card-border bg-card px-4 py-5">
        <figcaption className="font-semibold">{title}</figcaption>
        <p className="mt-2 text-sm leading-6 text-muted">{empty}</p>
      </figure>
    );
  }

  const width = 720;
  const height = 248;
  const pad = { left: 64, right: 16, top: 16, bottom: 32 };
  const times = points.map((point) => Date.parse(point.time));
  const values = points.map((point) => point.value);
  const minT = Math.min(...times);
  let maxT = Math.max(...times);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (minT === maxT) maxT += 1;
  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const yPad = (maxV - minV) * 0.1;
  minV -= yPad;
  maxV += yPad;
  const xOf = (time: string) => pad.left + ((Date.parse(time) - minT) / (maxT - minT)) * (width - pad.left - pad.right);
  const yOf = (value: number) => pad.top + ((maxV - value) / (maxV - minV)) * (height - pad.top - pad.bottom);
  const ticks = [0, 1, 2, 3].map((index) => minV + ((maxV - minV) * index) / 3);

  return (
    <figure className="rounded-2xl border border-card-border bg-card px-3 py-4 sm:px-4">
      <figcaption className="px-1">
        <h3 id={titleId} className="font-semibold">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </figcaption>
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-auto w-full rounded-lg bg-plot"
      >
        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} fill="#0c1422" />
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yOf(tick)} y2={yOf(tick)} stroke="#243044" />
            <text x={pad.left - 8} y={yOf(tick) + 4} textAnchor="end" fill="#c5d0e4" fontSize="11" fontFamily="ui-monospace, monospace">
              {formatMoney(tick, null)}
            </text>
          </g>
        ))}
        {usable.map((item) => {
          const line = item.points.map((point) => `${xOf(point.time)},${yOf(point.value)}`).join(" ");
          const baseline = yOf(Math.min(maxV, Math.max(minV, 0)));
          const area = `${pad.left},${baseline} ${line} ${xOf(item.points[item.points.length - 1].time)},${baseline}`;
          return (
            <g key={item.id}>
              <polygon points={area} fill={item.color} opacity="0.14" />
              <polyline points={line} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        <text x={pad.left} y={height - 8} fill="#c5d0e4" fontSize="11">
          {formatTime(new Date(minT).toISOString(), timeZone)}
        </text>
        <text x={width - pad.right} y={height - 8} textAnchor="end" fill="#c5d0e4" fontSize="11">
          {formatTime(new Date(maxT).toISOString(), timeZone)}
        </text>
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 px-1 text-sm">
        {usable.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
      <details className="mt-3 px-1 text-sm">
        <summary className="cursor-pointer text-muted">Chart data table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Data for {title}</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Series
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  Time
                </th>
                <th scope="col" className="py-1 font-medium">
                  Value{currency ? ` (${currency})` : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {usable.flatMap((item) =>
                item.points.map((point) => (
                  <tr key={`${item.id}-${point.time}-${point.value}`} className="border-t border-card-border">
                    <td className="py-1 pr-3">{item.label}</td>
                    <td className="py-1 pr-3">
                      <time dateTime={point.time}>{formatTime(point.time, timeZone)}</time>
                    </td>
                    <td className="num py-1">{formatMoney(point.value, currency)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
