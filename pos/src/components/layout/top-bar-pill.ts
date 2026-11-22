import { buttonClassName } from "@store/ui";

// The header's language and account menus wear the ui secondary button.
export const TOP_BAR_PILL = buttonClassName({
  variant: "secondary",
  className: "min-w-0 px-2.5 data-[state=open]:bg-primary-50",
});
