# @store/ui

The interface system: the components, the tokens they read, and the contract a product overrides to
make its own branded copy. One library, many products — this repository holds the first of them
(Abu-Obaid, in `apps/web`), and nothing in here names it or its colours.

## What is in it

```
src/
  index.ts              the barrel: every component a screen normally reaches for
  components/           40 modules, one per control — see the table below
  lib/
    cn.ts               clsx + a tailwind-merge that has been taught this theme's tokens
    direction.ts        the page's direction, read off <html> for portalled content
    page-action-slot.ts the node a page's primary action portals into; the host provides it
    page-title.ts       the context PageHeader registers a screen's title through
    use-delayed-loading.ts   skeleton timing: no flash, no blink
    use-media-query.ts  the md breakpoint, in JavaScript, agreeing with the CSS
    validation-message.ts    a Zod issue code → a translation key
  theme/
    tokens.ts           the token vocabulary, as closed unions
    create-theme.ts     ThemeOverride → the CSS-vars layer
    ui-provider.tsx     applies it at the root, and carries direction
  styles/
    base.css            every token with a neutral default, plus the base layer
    fonts.css           Tajawal, self-hosted, with its vertical metrics corrected
    fonts/              the woff2/woff files
```

## Installing it in a product

```jsonc
// the product's package.json
"dependencies": { "@clinic/ui": "workspace:*" }
```

```css
/* the product's entry stylesheet, in this order */
@import "tailwindcss";
@import "@clinic/ui/styles/base.css"; /* tokens with neutral defaults */
@import "./theme.css"; /* this product's values on top */
```

```tsx
<UiProvider theme={myTheme} direction="rtl" lang="ar">
  <App />
</UiProvider>
```

`base.css` carries its own `@source`, so Tailwind scans the package even though it sits outside the
app's root. The package is consumed from source — Vite compiles it, so an edit here hot-reloads the
browser and there is no build step to forget.

## Theming

Two layers, and they are not redundant:

- **`theme.css`, the product's own.** A `@theme static` block that redefines the token values.
  This is what the browser paints on the first byte, before any JavaScript runs — which is why the
  palette lives here and not only in TypeScript. It is also the only place a product may declare a
  token of its own (a dashboard banner, a tooth chart), because a new name needs a Tailwind utility
  generated for it.
- **`theme.ts`, the typed override.** The same values as a `ThemeOverride`, handed to `UiProvider`.
  This is what a runtime rebrand swaps, and what a second product copies and edits.

```ts
export interface ThemeOverride {
  color?: Partial<Record<ColorToken, string>>;
  radius?: Partial<Record<RadiusToken, string>>;
  shadow?: Partial<Record<ShadowToken, string>>;
  text?: Partial<Record<TextToken, { size: string; lineHeight?: string }>>;
  control?: Partial<Record<ControlToken, string>>;
  animation?: Partial<Record<AnimationToken, string>>;
  fontSans?: string;
  spacing?: string;
  trackingBody?: string;
}
```

Every key is a closed union of names `base.css` already declares: **a product supplies values, never
new names.** A name that exists in one product has no utility class in the others, and `cn`'s
tailwind-merge registry would not know it either.

Keep the two layers in step. `apps/web/src/theme.test.ts` is the worked example — it fails both when
`theme.ts` states a value `theme.css` does not, and when `theme.css` overrides a token `theme.ts`
forgot.

`createTheme(override)` renders the override as an unlayered `:root { … }` block, which outranks the
`@layer theme` rule `base.css` compiles to whatever the import order.

## Customising a component

**`className` and `data-part` are the only sanctioned paths.** Forking a component, or reaching into
its markup by tag or utility class, is not: both break on the next change here.

- **`className`** is on every component and goes through `cn`, so a caller's `w-64` beats the
  component's `w-full` rather than losing to stylesheet order.
- **`data-part`** names each inner part, so a product can reach one from plain CSS:

  ```css
  [data-part="field-icon"] {
    color: var(--color-primary-600);
  }
  [data-part="table-body-row"]:hover {
    background: var(--color-selected);
  }
  ```

`Icon`, `Img`, `Ltr` and `Input` take a `data-part` prop, so a composed control can name itself
(`MoneyInput` renders an `Input` as `data-part="money-input"`).

One rule when adding a part: **its value must not spell a Tailwind utility.** Tailwind scans raw
source text, so `data-part="table-cell"` generated a real `.table-cell { display: table-cell }` rule
for a class nothing wears. That is why the table's parts are `table-body-cell` and `table-body-row`.

## Naming a component for tests

**Every component takes `data-testid`, and one id names the whole subtree.** Each inner node's id is
its own `data-part` with the component's name swapped for the caller's, so the two are the same
shape and there is nothing to memorise per component:

```tsx
<Modal data-testid="payment" …>
// data-testid="payment", "payment-title", "payment-body", "payment-footer", "payment-overlay"
//    data-part="modal",     "modal-title",    "modal-body",    "modal-footer",    "modal-overlay"
```

A component given no `data-testid` renders exactly the DOM it did before, so the ids cost nothing
where nobody asked for them.

Ids that already exist are reused rather than asked for twice: `FormField` falls back to its
`htmlFor` (`patient-name` labels `patient-name-field`), and `DatePicker`, `TimePicker` and
`DateRangePicker` to their `id`. That covers every form in the app without a call site naming a
field a second time.

Where a component draws a list, each row's id carries the row's identity and its children hang off
it — `Table` derives `<testid>-row-<rowKey>` and then `<testid>-row-<rowKey>-<column.key>`, so a
selector that misses names the row it missed. `Select` does the same for its options, `Tabs` for its
tabs, and `SegmentedControl` for its segments.

The two singletons with no call site to name them, `Toast` and `Calendar`, carry fixed ids
(`toast`, `toast-title`, `calendar`, `calendar-day-2026-09-17`); a toast also carries `data-tone`.

`data-testid` is for tests and devtools, `data-part` for a product's CSS. Keep styling off the
testid: it is the one attribute a test may rename.

## The components

| Module                                        | Contract                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `avatar` — `Avatar`                           | A person at a glance: photo, or initials on a tint keyed to a stable id.                     |
| `badge` — `Badge`, `Chip`, `PILL_BASE`        | The one pill. `Badge` states, `Chip` chooses; never a solid fill.                            |
| `button` — `Button`                           | Five variants, two heights. One filled primary per page.                                     |
| `calendar` — `Calendar`                       | Opens on the days; the caption zooms out to months, then a scrolling list of years.          |
| `card` — `Card`                               | The panel: hairline, soft shadow, optional selected outline that takes no layout.            |
| `chat-bubble` — `ChatBubble`                  | A turn in a conversation: the question hugs its text, the answer fills the column.           |
| `chat-composer` — `ChatComposer`              | The box a question is typed in. Enter sends, Shift+Enter breaks, and it grows to five lines. |
| `chat-thread` — `ChatThread`                  | Follows the answer as it arrives, and stops the moment somebody scrolls up to read.          |
| `contact-link` — `PhoneLink`, `EmailLink`     | A number dials and an address opens a message; a dash where there is neither.                |
| `conversation-item` — `ConversationItem`      | A saved conversation in the rail: its name, when it last moved, and its own address.         |
| `date-picker` — `DatePicker`                  | A typed field that also anchors a calendar. Never opens on focus.                            |
| `date-range-picker` — `DateRangePicker`       | Two dates as one control, with a clear.                                                      |
| `dialog-layer` — `DialogLayerProvider`        | Publishes a dialog's node so a popover inside it escapes the inert body.                     |
| `drawer` — `Drawer`                           | The record panel from the inline end. Focuses nothing on open.                               |
| `empty-state` — `EmptyState`                  | Why a list is empty, and the one thing to do about it.                                       |
| `entity-card` — `EntityCard`, `EntityGrid`    | A record as a card: icon, title, status, progress, meta, one action.                         |
| `field` — `fieldShell`, `FieldIcon`, …        | The field's edge and fill, and the parts that sit in it. Every input draws from here.        |
| `form-field` — `FormField`                    | Label, control, and one slot shared by hint and error so the form never grows.               |
| `icon` — `Icon`                               | The whole glyph set, two sizes, mirrored where a glyph is a direction.                       |
| `img` — `Img`                                 | Never a raw `<img>`: the box is reserved before the file lands and never moves.              |
| `input` — `Input`                             | The text field, with an optional adornment, clear and suffix.                                |
| `ltr` — `Ltr`                                 | A left-to-right island for Latin digits inside Arabic text.                                  |
| `menu` — `Menu`, `MenuItem`, `RowMenu`        | The one menu. A row's second-rank actions behind one glyph.                                  |
| `modal` — `Modal`                             | The centred dialog. Focuses its container, not your first date field.                        |
| `money` — `Money`                             | Whole units and the currency **symbol**, in one LTR island.                                  |
| `money-input` — `MoneyInput`                  | Refuses a decimal separator as it is typed.                                                  |
| `page-header` — `PageHeader`                  | A screen's title, subtitle, count and actions; registers the tab title.                      |
| `person-name` — `PersonName`, `usePersonName` | A bilingual `{ ar, en }` name, resolved once instead of a ternary per screen.                |
| `picker-open` — `usePickerOpen`               | The open/close gesture a picker needs: click, Enter, Space, ArrowDown — never focus.         |
| `popover` — `Popover`                         | Anchors rather than triggers, and portals into a dialog when it is inside one.               |
| `progress-bar` — `ProgressBar`                | A real `progressbar` with its numbers attached, so it reads as "3 of 8".                     |
| `search-field` — `SearchField`                | The field shell as a search box, with a clear and an optional shortcut chip.                 |
| `segmented-control` — `SegmentedControl`      | A radio group: exactly one of these, with arrow keys.                                        |
| `select` — `Select`                           | Radix, not the platform: one control everywhere, and testable off the device.                |
| `skeleton` — `Skeleton`, and the shapes       | The loading shapes, one sweep, flat under reduced motion.                                    |
| `stat-card` — `StatCard`, `StatRow`           | A KPI: label chip, figure, optional delta and caption. Values arrive formatted.              |
| `suggestion-chips` — `SuggestionChips`        | The openers on an empty conversation, so nobody faces a blank field.                         |
| `switch` — `Switch`                           | A 44px target over a drawn track; the knob slides the right way in RTL.                      |
| `table` — `Table`, `Pagination`               | Rows on a wide screen, cards on a phone, one column definition for both.                     |
| `tabs` — `Tabs`, `TabPanel`, `useTabParam`    | Panels, and the hook that keeps the chosen one in the address bar.                           |
| `textarea` — `Textarea`                       | The field's edge and fill, growing vertically only.                                          |
| `time-picker` — `TimePicker`                  | A typed time that also anchors a list of slots.                                              |
| `toast` — `ToastProvider`, `useToast`         | Both methods take an i18n key, never a ready-made string.                                    |
| `tone` — `TONE_SURFACE`                       | A tone as a block rather than a pill, so a status is one colour in every view.               |
| `widget` — `Widget`                           | The panel's smaller sibling for a side column.                                               |

## What the host must provide

The library is not self-contained by design, and these are the seams:

- **i18n.** Components call `useTranslation()` and expect keys under `common.*`, `pagination.*` and
  `errors.validation.*` in both locales. The chat primitives are the exception: their few words —
  a placeholder, a send label, the jump pill — arrive as props, because they belong to the screen
  that uses them rather than to the library's shared vocabulary. `pnpm --filter @clinic/web check:i18n` scans this package
  too, so an Arabic literal in here fails the build exactly as it would in a screen.
- **A router.** `useTabParam` reads `useSearchParams`.
- **`@clinic/shared`.** The one domain dependency: `Money`, `MoneyInput` and `PersonName` use its
  money and person-name helpers. It is the thing to unpick first if this library ever ships outside
  this monorepo.
- **The two slots.** `PageActionSlotProvider` and `PageTitleProvider` — the host decides where a
  page's primary action rides and what writes `document.title`.

## Boundaries

`packages/ui` must not import from `apps/*`. ESLint enforces it both ways: the package cannot reach
into an app, and an app must import by package name (`@clinic/ui`, `@clinic/ui/components/…`) rather
than through the package's internal `@ui/…` alias. The public booking entry may import neither — it
has its own gzip budget and writes its own controls.

No Storybook in here yet; a catalogue is the obvious next thing and does not block the extraction.
