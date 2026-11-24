/** Decorative candles. The coordinates are drawn for the layout, not copied from a market. */
const CANDLES: [number, number, number, number, number][] = [
  [360, 150, 96, 78, 168],
  [404, 108, 142, 90, 160],
  [448, 148, 88, 70, 166],
  [492, 100, 132, 82, 154],
  [536, 138, 86, 64, 158],
  [580, 112, 148, 96, 176],
  [624, 156, 104, 88, 184],
  [668, 120, 78, 58, 146],
];

export function CandleBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 720 280" preserveAspectRatio="xMaxYMid slice">
        <defs>
          <linearGradient id="candle-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#070d18" />
            <stop offset="0.38" stopColor="#070d18" stopOpacity="0.94" />
            <stop offset="0.72" stopColor="#070d18" stopOpacity="0.35" />
            <stop offset="1" stopColor="#070d18" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {Array.from({ length: 7 }, (_, index) => (
          <line
            key={`h-${index}`}
            x1="0"
            x2="720"
            y1={36 + index * 36}
            y2={36 + index * 36}
            stroke="#1c3148"
            strokeWidth="1"
          />
        ))}
        {CANDLES.map(([x, open, close, high, low]) => {
          const up = close < open;
          const top = Math.min(open, close);
          const height = Math.max(10, Math.abs(close - open));
          return (
            <g key={x}>
              <line x1={x + 9} x2={x + 9} y1={high} y2={low} stroke="#e6b84d" strokeOpacity="0.7" strokeWidth="1.4" />
              <rect
                x={x}
                y={top}
                width="18"
                height={height}
                rx="1.5"
                fill={up ? "#145e57" : "#6e322c"}
                stroke={up ? "#5eead4" : "#f0b2a8"}
                strokeWidth="1.2"
              />
            </g>
          );
        })}
        <rect width="720" height="280" fill="url(#candle-fade)" />
      </svg>
    </div>
  );
}
