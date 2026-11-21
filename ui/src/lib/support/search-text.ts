import { foldDigits } from "@ui/lib/support/digits";

const ARABIC_MARKS = /[ً-ٰٟـ]/g;

// Folds what a typist may write differently: case, Arabic diacritics and tatweel, alef/ya/ta-marbuta forms, digits.
export function foldSearchText(value: string): string {
  return foldDigits(value)
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}
