import { barcodePattern } from '@organza/shared';
import { useMemo } from 'react';

/** Crisp vector bars at any printer resolution; the digits under the bars are for typing by hand. */
export function BarcodeSvg({
  code,
  height = 40,
  showText = true,
}: {
  code: string;
  height?: number;
  showText?: boolean;
}) {
  const pattern = useMemo(() => {
    try {
      return barcodePattern(code);
    } catch {
      return null;
    }
  }, [code]);
  if (!pattern) return <span dir="ltr">{code}</span>;
  const quiet = pattern.format === 'EAN13' ? 9 : 10;
  const width = pattern.runs.reduce((a, b) => a + b, 0) + quiet * 2;
  const textHeight = showText ? 9 : 0;
  const bars: { x: number; w: number; guard: boolean }[] = [];
  let x = quiet;
  pattern.runs.forEach((run, i) => {
    if (i % 2 === 0) bars.push({ x, w: run, guard: pattern.guards.has(i) });
    x += run;
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height + textHeight}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      role="img"
      aria-label={code}
    >
      <rect width={width} height={height + textHeight} fill="#fff" />
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={0}
          width={b.w}
          height={b.guard && showText ? height + 4 : height}
          fill="#000"
        />
      ))}
      {showText && (
        <text
          x={width / 2}
          y={height + textHeight - 1}
          fontSize={8}
          textAnchor="middle"
          fontFamily="monospace"
          direction="ltr"
        >
          {pattern.text}
        </text>
      )}
    </svg>
  );
}
