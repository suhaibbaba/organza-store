# Organza design system

Organza follows the clinic app's design system (decision 52 in `assumptions.md`), built on
Mantine. This page is the contract every screen follows.

## Rules

1. **No inline styles.** Do not use `style={{…}}` or Mantine style props (`c`, `fw`, `fz`, `ta`,
   `m*`, `p*`, `w`, `h`, `maw`, `miw`, `bg`, `lh`, `tt`, `td`, `opacity`, …).
   `pnpm --filter @organza/web lint` runs `scripts/check-styles.mjs` and fails on any of them.
   - The one exception is passing **data** to CSS through custom properties, such as
     `style={{ '--bar': '42%' }}`. The CSS module then uses `height: var(--bar)`.
2. **Style comes from four places only:**
   - the `ds-*` utility classes in `apps/web/src/styles/ds.css`;
   - the shared components in `apps/web/src/shared/components`;
   - Mantine component props that pick a design token, such as `size`, `color`, `variant`, `gap`,
     `padding`, `radius`, `justify`, `align` and `cols`;
   - the screen's own `*.module.css`, using the `--o-*` tokens.
3. **No raw values in module CSS** when a token exists. Colours, shadows and radii come from
   `--o-*` in `styles/clinic.css`. Plain hex only (Safari 15: no `color-mix`, `oklch` or
   container queries).
4. **Controls are 36px**, small ones 28px, and nothing is taller. This is enforced globally in
   `clinic.css`, so never set a control's height.
5. **Every visible word is a translation key** (ar, en and he). `scripts/check-i18n.mjs`
   enforces this.

## Tokens (`styles/clinic.css`)

| Group    | Tokens                                                                                 |
| -------- | -------------------------------------------------------------------------------------- |
| Font     | `--o-font`: Tajawal 400/500/700 (Noto Sans Hebrew for Hebrew)                          |
| Primary  | `--o-primary-50 … 900`, main `600` `#1b6f97`, deep `900` `#0e3d55`                     |
| Success  | `--o-success-100/500/700/800/900`, main `500` `#39ba97`                                |
| Danger   | `--o-danger-100/600/700`                                                               |
| Warning  | `--o-warning-100/700`                                                                  |
| Ink      | `--o-ink` `#12303f`, `--o-ink-muted`, `--o-ink-subtle`, `--o-ink-faint`, `--o-title`   |
| Surfaces | `--o-canvas`, `--o-inset`, `--o-sunken`, `--o-rail`, `--o-row-hover`, `--o-table-head` |
| Lines    | `--o-line` `#e0eaee` (hairlines), `--o-line-strong` `#c9d8de` (inputs)                 |
| Shadows  | `--o-shadow-card`, `--o-shadow-card-hover`, `--o-shadow-nav`, `--o-shadow-float`       |
| Washes   | `--o-wash` (badge gradient), `--o-banner`, `--o-nav-active`                            |

Radii:

- Mantine `xs` is 8 (chips), `sm` is 10 (controls), `md` is 12, `lg` is 14 (panels) and `xl` is 20
  (cards).

Mantine colour names map onto the palette:

- `blue`, `cyan` and `indigo` are primary;
- `green` and `teal` are mint;
- `red` and `pink` are brick;
- `orange` and `yellow` are ochre;
- `gray` and `dark` are slate;
- `violet` and `grape` are violet.

## Utility classes (`styles/ds.css`)

| Purpose       | Classes                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Size          | `ds-text-xs` 12, `ds-text-sm` 13, `ds-text-md` 14, `ds-text-lg` 15, `ds-text-xl` 18, `ds-text-2xl` 22, `ds-text-3xl` 28        |
| Weight        | `ds-regular`, `ds-medium`, `ds-bold`                                                                                           |
| Colour        | `ds-ink`, `ds-title`, `ds-muted`, `ds-subtle`, `ds-faint`, `ds-primary`, `ds-success`, `ds-warning`, `ds-danger`, `ds-on-dark` |
| Alignment     | `ds-start`, `ds-center`, `ds-end`                                                                                              |
| Flow          | `ds-nowrap`, `ds-truncate`, `ds-break`, `ds-pre-line`, `ds-strike`, `ds-upper`                                                 |
| Numbers       | `ds-num` (tabular figures), `ds-ltr` (phone numbers and codes: left-to-right, at the reading start)                            |
| Spacing       | `ds-mt-{xs,sm,md,lg}`, `ds-mb-{xs,sm,md,lg}`, `ds-ms-auto`, `ds-p-0`                                                           |
| Sizing        | `ds-full`, `ds-grow`, `ds-shrink-0`, `ds-min-0`, `ds-w-sm` 400, `ds-w-md` 560, `ds-w-lg` 760, `ds-w-xl` 960                    |
| Table columns | `ds-col-thumb` 60, `ds-col-xs` 80, `ds-col-sm` 120, `ds-col-md` 160, `ds-col-lg` 220, `ds-col-actions`                         |
| States        | `ds-clickable`, `ds-dimmed`, `ds-hidden`                                                                                       |
| Surfaces      | `ds-surface`, `ds-inset`, `ds-sunken`, `ds-wash`, `ds-divider-top`, `ds-divider-bottom`                                        |
| Headings      | `ds-eyebrow` (12px section label), `ds-heading` (14px bold panel title), `ds-figure` (22px number)                             |
| Lists         | `o-list` on a `Stack` of row `Card`s turns them into one list card                                                             |

Combine the classes, for example `className="ds-text-sm ds-muted"`. Prefer layout components
(`Stack`/`Group` `gap`) over margins.

Mapping from the old props:

- `c="dimmed"` becomes `ds-muted`.
- `fw={600}` or `fw={700}` becomes `ds-bold`; `fw={500}` becomes `ds-medium`.
- `ta="end"` becomes `ds-end`.
- `mb="md"` becomes `ds-mb-md`, or better a `Stack` gap.
- `maw={760}` becomes `ds-w-lg`.
- `c="red"` becomes `ds-danger`.
- `Card p={0}` becomes `Card padding={0}`.

## Components (`shared/components`)

| Component                                      | Use                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHeader`                                   | Every page: `title`, `subtitle`, `back`, `count`, `actions`. `primary` is the page's main button, which moves into the top bar from 1025px. |
| `BackLink`                                     | The back link on detail pages that lay out their own header.                                                                                |
| `PageAction`                                   | Puts any button into the top bar's action slot.                                                                                             |
| `StatCard`, `StatGrid`                         | KPI cards: a wash label with an icon, a 22px figure, a foot line, and a tone.                                                               |
| `Widget`, `WidgetRow`, `SeeAll`                | Dashboard panels and the rows inside them.                                                                                                  |
| `Banner`                                       | The greeting or summary banner.                                                                                                             |
| `Initials`                                     | A person's initials on a tint chosen from their name. Sizes are `sm` 32, `md` 36 and `lg` 44.                                               |
| `MoneyInput`, `TranslatableInput`              | Form fields.                                                                                                                                |
| `FullScreenLoader`, `ErrorState`, `EmptyState` | Page states.                                                                                                                                |

## Patterns

- **List page:**
  - a `PageHeader` with `primary`;
  - a filter row (search `TextInput` with a `grow` class, then `SegmentedControl` or `Select`);
  - a `Card padding={0}` holding a `Table.ScrollContainer`, or a `Stack className="o-list"` of
    row cards on phones.
- **Detail page:**
  - a `BackLink`, then the title (22/30, 500, `--o-title`) with status badges;
  - actions at the end;
  - content in a main column and a 320px side column of `Card`s.
- **Form page:**
  - a `PageHeader` with `back`;
  - `Card` sections, each with a `ds-heading` title;
  - the save bar at the end, with the primary action last in reading order.
- **Dialogs:** Mantine `Modal` (20px radius, centred, ink overlay). The footer is a `Group`
  aligned to the end, with Cancel (`variant="default"`) before the primary button.
