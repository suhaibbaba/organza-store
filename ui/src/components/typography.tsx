import type { HTMLAttributes, JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";

// The type scale as roles (ported from operate-web): variant sets size, weight and the default tag.
export type TypographyVariant = "display" | "h1" | "h2" | "h3" | "h4" | "body" | "small" | "caption" | "label";
export type TypographyTone =
  "ink" | "muted" | "subtle" | "brand" | "error" | "success" | "inverse" | "inverseMuted" | "inherit";
export type TypographyWeight = "regular" | "medium" | "semibold" | "bold";
export type TypographyTag =
  "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div" | "label" | "legend" | "strong" | "dt" | "dd";

const VARIANTS: Record<TypographyVariant, string> = {
  display: "text-headline font-bold",
  h1: "text-title font-medium",
  h2: "text-heading font-medium",
  h3: "text-section font-medium",
  h4: "text-value font-medium",
  body: "text-value",
  small: "text-label",
  caption: "text-meta",
  label: "text-label",
};

const TONES: Record<TypographyTone, string> = {
  ink: "text-ink",
  muted: "text-ink-muted",
  subtle: "text-ink-subtle",
  brand: "text-primary-700",
  error: "text-danger-700",
  success: "text-success-700",
  // On the dark rail.
  inverse: "text-rail-ink-active",
  inverseMuted: "text-rail-ink",
  inherit: "",
};

const WEIGHTS: Record<TypographyWeight, string> = {
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const TAGS: Record<TypographyVariant, TypographyTag> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  body: "p",
  small: "p",
  caption: "span",
  label: "span",
};

export type TypographyProps = HTMLAttributes<HTMLElement> & {
  variant?: TypographyVariant | undefined;
  tone?: TypographyTone | undefined;
  weight?: TypographyWeight | undefined;
  // The tag when meaning and look differ, e.g. an h1 that looks like h2.
  as?: TypographyTag | undefined;
  htmlFor?: string | undefined;
  children?: ReactNode;
};

export function typographyClassName({
  variant = "body",
  tone = "ink",
  weight,
  className,
}: Pick<TypographyProps, "variant" | "tone" | "weight" | "className"> = {}): string {
  return cn(VARIANTS[variant], TONES[tone], weight && WEIGHTS[weight], className);
}

export function Typography({ variant = "body", tone, weight, as, className, ...props }: TypographyProps): JSX.Element {
  const Tag = as ?? TAGS[variant];
  return (
    <Tag data-slot="typography" className={typographyClassName({ variant, tone, weight, className })} {...props} />
  );
}
