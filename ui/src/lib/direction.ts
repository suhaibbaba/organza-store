export function documentDirection(): "rtl" | "ltr" {
  return typeof document !== "undefined" && document.documentElement.dir === "rtl" ? "rtl" : "ltr";
}
