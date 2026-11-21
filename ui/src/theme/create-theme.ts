import type {
  AnimationToken,
  ColorToken,
  ControlToken,
  RadiusToken,
  ShadowToken,
  TextToken,
} from "@ui/theme/tokens";

export interface ThemeOverride {
  readonly color?: Partial<Record<ColorToken, string>> | undefined;
  readonly radius?: Partial<Record<RadiusToken, string>> | undefined;
  readonly shadow?: Partial<Record<ShadowToken, string>> | undefined;
  readonly text?:
    Partial<Record<TextToken, { readonly size: string; readonly lineHeight?: string }>> | undefined;
  readonly control?: Partial<Record<ControlToken, string>> | undefined;
  readonly animation?: Partial<Record<AnimationToken, string>> | undefined;
  readonly fontSans?: string | undefined;
  readonly spacing?: string | undefined;
  readonly trackingBody?: string | undefined;
}

export type ThemeVariables = Readonly<Record<string, string>>;

export function themeVariables(theme: ThemeOverride): ThemeVariables {
  const variables: Record<string, string> = {};

  for (const [name, value] of Object.entries(theme.color ?? {})) {
    variables[`--color-${name}`] = value;
  }

  for (const [name, value] of Object.entries(theme.radius ?? {})) {
    variables[`--radius-${name}`] = value;
  }

  for (const [name, value] of Object.entries(theme.shadow ?? {})) {
    variables[`--shadow-${name}`] = value;
  }

  for (const [name, value] of Object.entries(theme.text ?? {})) {
    variables[`--text-${name}`] = value.size;

    if (value.lineHeight !== undefined) {
      variables[`--text-${name}--line-height`] = value.lineHeight;
    }
  }

  for (const [name, value] of Object.entries(theme.control ?? {})) {
    variables[`--control-${name}`] = value;
  }

  for (const [name, value] of Object.entries(theme.animation ?? {})) {
    variables[`--animate-${name}`] = value;
  }

  if (theme.fontSans !== undefined) {
    variables["--font-sans"] = theme.fontSans;
  }

  if (theme.spacing !== undefined) {
    variables["--spacing"] = theme.spacing;
  }

  if (theme.trackingBody !== undefined) {
    variables["--tracking-body"] = theme.trackingBody;
  }

  return variables;
}

export function createTheme(theme: ThemeOverride): string {
  const declarations = Object.entries(themeVariables(theme)).map(
    ([name, value]) => `  ${name}: ${value};`,
  );

  return declarations.length === 0 ? "" : `:root {\n${declarations.join("\n")}\n}\n`;
}
