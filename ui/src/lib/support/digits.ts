const ARABIC_INDIC = 0x0660;
const EASTERN_ARABIC_INDIC = 0x06f0;

export function foldDigits(value: string): string {
  let out = "";

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const arabic = code - ARABIC_INDIC;
    const eastern = code - EASTERN_ARABIC_INDIC;

    if (arabic >= 0 && arabic <= 9) {
      out += String(arabic);
    } else if (eastern >= 0 && eastern <= 9) {
      out += String(eastern);
    } else {
      out += character;
    }
  }

  return out;
}

export function cleanTypedNumber(value: string, inputMode: string | undefined): string {
  if (inputMode === "numeric") {
    return foldDigits(value).replace(/\D/g, "");
  }

  if (inputMode === "decimal") {
    const [whole = "", ...fraction] = foldDigits(value)
      .replace(/[\u066B,]/g, ".")
      .replace(/[^\d.]/g, "")
      .split(".");

    return fraction.length > 0 ? `${whole}.${fraction.join("")}` : whole;
  }

  if (inputMode === "tel") {
    return foldDigits(value);
  }

  return value;
}
