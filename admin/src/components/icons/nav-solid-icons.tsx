import type { PrimaryNavKey } from "@/constants/nav";
import type { SolidIcon, SolidIconProps } from "@/types/nav";

// Solid twins of the lucide outline icons the bottom nav uses, for the tab you
// are on.
//
// WHY THESE EXIST. lucide ships one outline set and no solid one, so "solid"
// used to mean `fill="currentColor"` on the outline icon itself. That works
// only for glyphs whose meaning is a silhouette. It destroys every glyph whose
// meaning is in its INNER strokes: the receipt's three lines are separate open
// paths, so filling floods the body and the lines fill to nothing — an
// unreadable blob. Boxes went the same way, its three cubes merging into one
// clover. A filled icon has to be DRAWN filled, with its detail knocked out of
// the body as negative space; it can never be an outline icon with paint
// poured into it.
//
// HOW THE DETAIL SURVIVES, per glyph:
//   * receipt — one filled body with the three lines as evenodd holes, so they
//     read as the nav's own background showing through, in either theme.
//   * boxes   — each cube is drawn as three separate faces with a gap along
//     every seam, so the seams that make a cube read as a cube are the space
//     between the faces rather than lines on top of them.
//   * dashboard — four separate panels; there is nothing inside them to lose.
//   * shirt   — a silhouette glyph: no inner strokes at all, so filling it
//     loses nothing. It gets a knocked-out collar so it carries the same kind
//     of inner detail as the other three and the bar reads as one set.
//
// Geometry is kept on lucide's 24x24 grid and traced from lucide's own paths,
// so the solid and the outline are the same glyph in two weights — the tab
// changes state, it does not change picture. Path data lives here, with the
// component that draws it, the way an icon set keeps its own geometry.

// lucide's receipt body, verbatim (ISC) — the outline and the solid then have
// exactly the same silhouette.
const RECEIPT_BODY =
  "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z";

// One receipt line as a closed capsule, at the same x-spans and y positions
// lucide strokes them, a shade thinner than its 2-unit stroke so the body
// keeps enough weight around them.
const LINE_RADIUS = 0.85;
function receiptLine(x1: number, x2: number, y: number): string {
  const r = LINE_RADIUS;
  return `M${x1} ${y - r}H${x2}a${r} ${r} 0 0 1 0 ${2 * r}H${x1}a${r} ${r} 0 0 1 0 ${-2 * r}z`;
}

const RECEIPT_LINES = [receiptLine(8, 14, 8), receiptLine(8, 16, 12), receiptLine(8, 13, 16)].join("");

// The nine faces of the three cubes — three per cube (top, left, right), each
// pulled 1 unit off its seams so the seams open as gaps. Generated on lucide's
// isometric grid (half-width 5, rise 2.85, body height 5.2) around the same
// three centres lucide uses: (12,8) on top, (7,16.5) and (17,16.5) below.
const CUBE_FACES = [
  "M12 3.3L16 5.15L12 7L8 5.15Z",
  "M7.53 6L11.09 8.43L11.47 12.35L7.91 9.92Z",
  "M12.91 8.43L16.47 6L16.09 9.92L12.53 12.35Z",
  "M7 11.8L11 13.65L7 15.5L3 13.65Z",
  "M2.53 14.5L6.09 16.93L6.47 20.85L2.91 18.42Z",
  "M7.91 16.93L11.47 14.5L11.09 18.42L7.53 20.85Z",
  "M17 11.8L21 13.65L17 15.5L13 13.65Z",
  "M12.53 14.5L16.09 16.93L16.47 20.85L12.91 18.42Z",
  "M17.91 16.93L21.47 14.5L21.09 18.42L17.53 20.85Z",
];

// A hairline stroke in the same colour rounds the faces' corners back off (a
// fill alone can only give mitred points) without closing the seams — it grows
// each face by half of this, and the gaps are cut a full unit wide to absorb it.
const CUBE_EDGE_WIDTH = 0.7;

function Svg({ className, children }: SolidIconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Four panels, each a rounded rect on lucide's coordinates grown by its 1-unit
// stroke — same footprint, same gaps, no inner detail to lose.
function DashboardSolid({ className }: SolidIconProps) {
  return (
    <Svg className={className}>
      <path d="M4 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M15 2h5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M15 11h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="M4 15h5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

// The one this whole file exists for: body and lines in a single path, with
// evenodd so the lines are holes rather than paint. Winding direction of the
// capsules is then irrelevant — anything enclosed by the body is knocked out.
function OrdersSolid({ className }: SolidIconProps) {
  return (
    <Svg className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d={`${RECEIPT_BODY}${RECEIPT_LINES}`} />
    </Svg>
  );
}

// lucide's shirt silhouette (ISC), plus a collar band knocked out of it: the
// neckline is the only inner detail this glyph has, and it is what keeps the
// filled shape reading as a garment rather than as a paper cut-out.
function ProductsSolid({ className }: SolidIconProps) {
  return (
    <Svg className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23zM16.98 3.81A5.3 5.3 0 0 1 7.02 3.81L7.77 3.54A4.5 4.5 0 0 0 16.23 3.54Z"
      />
    </Svg>
  );
}

function InventorySolid({ className }: SolidIconProps) {
  return (
    <Svg className={className}>
      <g stroke="currentColor" strokeWidth={CUBE_EDGE_WIDTH} strokeLinejoin="round">
        {CUBE_FACES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </Svg>
  );
}

// Typed against PrimaryNavKey rather than NavKey on purpose: adding a tab to
// PRIMARY_NAV_KEYS without drawing its solid twin is then a compile error, not
// another blob nobody notices until it ships.
export const SOLID_NAV_ICONS: Record<PrimaryNavKey, SolidIcon> = {
  dashboard: DashboardSolid,
  orders: OrdersSolid,
  products: ProductsSolid,
  inventory: InventorySolid,
};
