// A legend is always present when a chart plots more than one series — the
// reader must never have to match colours from memory. Rendered as plain
// HTML above the chart so it mirrors correctly in RTL and stays legible at
// phone text sizes.
export interface ChartLegendItem {
  label: string;
  color: string;
}

export function ChartLegend({ items }: { items: ChartLegendItem[] }) {
  if (items.length < 2) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
