// Native <input type="number"> is unreliable on mobile: no guaranteed
// numeric keypad, and iOS Safari can strand the field when the last digit
// is deleted. Every numeric field instead uses type="text" + inputMode +
// pattern (see components/ui/numeric-input.tsx) with these shared patterns,
// so the on-screen keypad and validation agree everywhere.
export const INTEGER_INPUT_PATTERN = "[0-9]*";
export const DECIMAL_INPUT_PATTERN = "[0-9]*\\.?[0-9]*";

export const INTEGER_STRING_REGEX = /^[0-9]*$/;
export const DECIMAL_STRING_REGEX = /^[0-9]*\.?[0-9]*$/;
