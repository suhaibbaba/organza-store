// A real, tiny PNG (8×8, 95 bytes), for the one test that has to upload
// something sharp will actually accept.
//
// Inline rather than a file on disk: it is 95 bytes, it never changes, and a
// binary fixture in the repo is one more thing that can go missing from a
// checkout — while a test that silently stops uploading anything would still
// pass its "the endpoint answered" assertions.
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWMQiYrCihiGlgQAeGUyAY88c3MAAAAASUVORK5CYII=";

export const TINY_PNG = Buffer.from(TINY_PNG_BASE64, "base64");

// Two more of the same, for the one thing an upload has to READ out of a
// photograph rather than write: how light or dark it is (spec.md "Numbered
// shawls" — the numbers' colour is suggested from it). Near-black and
// near-white rather than pure, so the reading is a measurement and not a
// special case.
export const DARK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQI12PgwAEYhpYEAFjmBgGSW/TNAAAAAElFTkSuQmCC",
  "base64"
);

export const LIGHT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQI12P4hQMwDC0JAEMPu4HDY9MWAAAAAElFTkSuQmCC",
  "base64"
);
