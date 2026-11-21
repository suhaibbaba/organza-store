// type="number" is unreliable on mobile, so numeric fields use type="text" + inputMode + these patterns.
export const INTEGER_INPUT_PATTERN = "[0-9]*";
export const DECIMAL_INPUT_PATTERN = "[0-9]*\\.?[0-9]*";

export const INTEGER_STRING_REGEX = /^[0-9]*$/;
export const DECIMAL_STRING_REGEX = /^[0-9]*\.?[0-9]*$/;
