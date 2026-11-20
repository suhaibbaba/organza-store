// The top bar's two pills — the language and the account — drawn alike: a
// white rounded pill with a hairline border, 44px tall for a thumb.
export const TOP_BAR_PILL = [
  "group flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 text-start text-foreground",
  "transition-colors hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "data-[state=open]:bg-soft",
].join(" ");
