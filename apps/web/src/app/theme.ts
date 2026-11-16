import {
  createTheme,
  defaultVariantColorsResolver,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type VariantColorsResolver,
} from '@mantine/core';

/**
 * The clinic design system (docs/assumptions.md 52): teal-blue primary, mint success, brick
 * danger, ochre warning and blue-grey neutrals, Tajawal, 36px controls (28px small), 10px
 * control radius and 20px cards. Exact values live in styles/clinic.css as `--o-*` tokens; the
 * tuples below map the same colours onto Mantine's colour names so `color="green"` and friends
 * follow the palette. Plain hex only, for Safari 15.
 */
const brand: MantineColorsTuple = [
  '#f1f7fa',
  '#e1eef5',
  '#c8dfec',
  '#a5c9de',
  '#6aa5c3',
  '#2e80a8',
  '#1b6f97',
  '#155b7d',
  '#114d6a',
  '#0e3d55',
];
const mint: MantineColorsTuple = [
  '#effaf6',
  '#dcf3ec',
  '#c1ebdd',
  '#a5e2cd',
  '#6dcfb1',
  '#39ba97',
  '#2ca886',
  '#1d7f64',
  '#1e7a62',
  '#0f7a5d',
];
const brick: MantineColorsTuple = [
  '#fef5f4',
  '#fbeae8',
  '#fce8e6',
  '#e9a59e',
  '#d77c73',
  '#c4544a',
  '#b03a31',
  '#a03b31',
  '#7a2720',
  '#5e1d18',
];
const ochre: MantineColorsTuple = [
  '#fdf8ec',
  '#fbf1da',
  '#f3dfac',
  '#e8cb83',
  '#d0aa4f',
  '#b98a1c',
  '#a47611',
  '#8f6206',
  '#6e4b04',
  '#523803',
];
const slate: MantineColorsTuple = [
  '#f1f6f7',
  '#e9f0f2',
  '#e0eaee',
  '#c9d8de',
  '#a3bac6',
  '#768d99',
  '#56707c',
  '#4e6975',
  '#2c4f5e',
  '#12303f',
];
const violet: MantineColorsTuple = [
  '#f6f3fc',
  '#ede8f8',
  '#ddd3f2',
  '#c4b5e8',
  '#9f87d6',
  '#7b5ec2',
  '#6a4cb5',
  '#5b3ea6',
  '#4a3288',
  '#3a276b',
];

/** Light variants are the clinic's tone fills (tint 100 under ink 700); filled is shade 6. */
const variantColorResolver: VariantColorsResolver = (input) => {
  const base = defaultVariantColorsResolver(input);
  const name = typeof input.color === 'string' ? input.color.split('.')[0] : undefined;
  const tuple = name ? input.theme.colors[name] : undefined;
  if (!tuple) return base;
  if (input.variant === 'light')
    return {
      ...base,
      background: tuple[1],
      hover: tuple[2],
      color: tuple[7],
      border: 'transparent',
    };
  if (input.variant === 'filled')
    return { ...base, background: tuple[6], hover: tuple[7], color: '#ffffff' };
  if (input.variant === 'subtle')
    return { ...base, hover: slate[1], color: tuple[name === 'gray' ? 7 : 6] };
  return base;
};

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  colors: {
    brand,
    blue: brand,
    cyan: brand,
    indigo: brand,
    teal: mint,
    green: mint,
    red: brick,
    pink: brick,
    orange: ochre,
    yellow: ochre,
    gray: slate,
    dark: slate,
    violet,
    grape: violet,
  },
  black: '#12303f',
  white: '#ffffff',
  variantColorResolver,
  fontFamily: 'var(--o-font)',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: {
    fontFamily: 'var(--o-font)',
    fontWeight: '500',
    sizes: {
      h1: { fontSize: '22px', lineHeight: '30px' },
      h2: { fontSize: '22px', lineHeight: '30px' },
      h3: { fontSize: '18px', lineHeight: '26px' },
      h4: { fontSize: '16px', lineHeight: '24px' },
      h5: { fontSize: '15px', lineHeight: '22px' },
      h6: { fontSize: '14px', lineHeight: '20px' },
    },
  },
  defaultRadius: 'sm',
  radius: { xs: '8px', sm: '10px', md: '12px', lg: '14px', xl: '20px' },
  spacing: { xs: '6px', sm: '10px', md: '16px', lg: '20px', xl: '28px' },
  fontSizes: { xs: '12px', sm: '14px', md: '15px', lg: '16px', xl: '18px' },
  shadows: {
    xs: '0 1px 2px rgb(18 48 63 / 0.08)',
    sm: '0 12px 28px -18px rgb(27 111 151 / 0.35), 0 2px 6px -3px rgb(27 111 151 / 0.12)',
    md: '0 8px 24px -14px rgb(14 61 85 / 0.35)',
    lg: '0 18px 34px -18px rgb(27 111 151 / 0.45)',
    xl: '0 18px 40px -18px rgb(14 61 85 / 0.45), 0 2px 8px -4px rgb(14 61 85 / 0.16)',
  },
  cursorType: 'pointer',
  /* Keyboard focus only: mouse and touch users see no ring, as in the clinic. */
  focusRing: 'auto',
  components: {
    Card: { defaultProps: { radius: 'xl', withBorder: true, shadow: 'sm', padding: 'lg' } },
    Paper: { defaultProps: { radius: 'xl' } },
    Modal: {
      defaultProps: {
        radius: 'xl',
        centered: true,
        overlayProps: { backgroundOpacity: 0.4, color: '#12303f' },
      },
    },
    Drawer: {
      defaultProps: { overlayProps: { backgroundOpacity: 0.5, color: '#12303f', blur: 2 } },
    },
    Menu: { defaultProps: { radius: 'lg', shadow: 'md' } },
    Popover: { defaultProps: { radius: 'lg', shadow: 'md' } },
    Combobox: { defaultProps: { radius: 'lg', shadow: 'md' } },
    Badge: { defaultProps: { radius: 'xl', variant: 'light' } },
    Tabs: { defaultProps: { variant: 'pills', radius: 'xl' } },
    SegmentedControl: { defaultProps: { radius: 'xl' } },
    Alert: { defaultProps: { radius: 'lg', variant: 'light' } },
    Notification: { defaultProps: { radius: 'xl' } },
    Avatar: { defaultProps: { radius: 'xl' } },
    Table: { defaultProps: { verticalSpacing: 'sm', horizontalSpacing: 'md' } },
  },
});

/** Hairlines are the clinic's #e0eaee; inputs keep the stronger #c9d8de (clinic.css). */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#ffffff',
    '--mantine-color-text': '#12303f',
    '--mantine-color-dimmed': '#4e6975',
    '--mantine-color-default-border': '#e0eaee',
    '--mantine-color-default-hover': '#e9f0f2',
    '--mantine-color-default-color': '#12303f',
    '--mantine-color-anchor': '#1b6f97',
    '--mantine-color-placeholder': '#56707c',
  },
  dark: {},
});
