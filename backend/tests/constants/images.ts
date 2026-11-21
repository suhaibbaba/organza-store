// A real 8×8 PNG sharp accepts, inline so the fixture can never go missing from a checkout.
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWMQiYrCihiGlgQAeGUyAY88c3MAAAAASUVORK5CYII=";

export const TINY_PNG = Buffer.from(TINY_PNG_BASE64, "base64");

// Near-black and near-white PNGs, so the light/dark reading is a measurement, not a special case.
export const DARK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQI12PgwAEYhpYEAFjmBgGSW/TNAAAAAElFTkSuQmCC",
  "base64",
);

export const LIGHT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQI12P4hQMwDC0JAEMPu4HDY9MWAAAAAElFTkSuQmCC",
  "base64",
);
