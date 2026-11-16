import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Design tokens live here and in styles/tokens.css. Colours are plain hex so Safari 15 reads
 * them natively (no color-mix, no oklch in our own styles).
 */
const plum: MantineColorsTuple = [
  '#f9eef6',
  '#ecdbe7',
  '#d9b4ce',
  '#c68ab4',
  '#b6679e',
  '#ad5191',
  '#a9458b',
  '#943678',
  '#842e6b',
  '#74245e',
];

export const theme = createTheme({
  primaryColor: 'plum',
  colors: { plum },
  primaryShade: { light: 7, dark: 4 },
  fontFamily: 'var(--organza-font)',
  headings: { fontFamily: 'var(--organza-font)', fontWeight: '700' },
  defaultRadius: 'md',
  radius: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  spacing: { xs: '6px', sm: '10px', md: '16px', lg: '24px', xl: '32px' },
  fontSizes: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '22px' },
  cursorType: 'pointer',
  components: {
    TextInput: { defaultProps: { size: 'md' } },
    PasswordInput: { defaultProps: { size: 'md' } },
    NumberInput: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' } },
    Button: { defaultProps: { size: 'md' } },
  },
});
