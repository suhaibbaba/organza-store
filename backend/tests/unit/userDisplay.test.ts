// How a person is named on screen (shared/src/lib/userDisplay.ts).
//
// Two things these pin, and both are about damage: an internal id must never
// reach a screen, and the rule that removes one must never eat a real name.
// The second is the reason the id test is as narrow as it is — this code
// deletes words somebody may have typed on purpose.
import { describe, expect, it } from "vitest";
import {
  cleanUserName,
  emailLocalPart,
  looksLikeInternalId,
  userDisplayName,
  userInitial,
} from "@organza/shared/lib/userDisplay";

describe("spotting an internal id", () => {
  it("recognizes the shapes that actually reach the name field", () => {
    // A test nonce: Date.now() in base 36 plus six random characters. This is
    // the exact shape that renamed a sandbox's Admin to "Admin mt0grbxoqx7nbf".
    expect(looksLikeInternalId("mt0grbxoqx7nbf")).toBe(true);
    expect(looksLikeInternalId("mt0lvkbaksaqkk")).toBe(true);
    // A cuid, with and without its leading letter.
    expect(looksLikeInternalId("cmt0dazje00197duhnjd8cmhk")).toBe(true);
  });

  it("leaves anything that could be part of a name alone", () => {
    // Ordinary words, however long.
    expect(looksLikeInternalId("muhammad")).toBe(false);
    expect(looksLikeInternalId("abdulrahman")).toBe(false);
    expect(looksLikeInternalId("constantinople")).toBe(false);
    // Capitals anywhere: a person writes their name with them, an id does not.
    expect(looksLikeInternalId("AlQuds2000shop")).toBe(false);
    // Short, even when it mixes letters and digits.
    expect(looksLikeInternalId("shop2")).toBe(false);
    expect(looksLikeInternalId("a1b2c3d4")).toBe(false);
    // Digits alone are a number somebody meant, not an id.
    expect(looksLikeInternalId("123456789012")).toBe(false);
    // Arabic and Hebrew can never match — the default locale's names are safe
    // by construction, which is most of why the rule is ASCII-only.
    expect(looksLikeInternalId("محمدعبدالرحمن")).toBe(false);
    expect(looksLikeInternalId("ישראלישראלי")).toBe(false);
  });
});

describe("cleaning a stored name", () => {
  it("drops an id and keeps the words around it", () => {
    expect(cleanUserName("Admin mt0grbxoqx7nbf")).toBe("Admin");
    expect(cleanUserName("mt0grbxoqx7nbf Admin")).toBe("Admin");
  });

  it("gives up rather than showing an id on its own", () => {
    expect(cleanUserName("mt0grbxoqx7nbf")).toBeNull();
    expect(cleanUserName("   ")).toBeNull();
    expect(cleanUserName("")).toBeNull();
    expect(cleanUserName(null)).toBeNull();
  });

  it("returns an ordinary name untouched, whitespace tidied", () => {
    expect(cleanUserName("سهيب بابا")).toBe("سهيب بابا");
    expect(cleanUserName("  Suhaib   Baba  ")).toBe("Suhaib Baba");
  });
});

describe("falling back to the email", () => {
  it("uses the local part, with its punctuation read as spaces", () => {
    expect(emailLocalPart("suhaib.baba@organza.test")).toBe("suhaib baba");
    expect(emailLocalPart("employee@organza.test")).toBe("employee");
    expect(emailLocalPart("a_b-c@x.test")).toBe("a b c");
  });

  it("has nothing to give for an address it cannot read", () => {
    expect(emailLocalPart("@organza.test")).toBeNull();
    expect(emailLocalPart("")).toBeNull();
    expect(emailLocalPart(null)).toBeNull();
  });
});

describe("what a screen shows", () => {
  it("prefers the name, then the email, then nothing", () => {
    expect(userDisplayName({ name: "Suhaib", email: "s@x.test" })).toBe("Suhaib");
    // The name is only an id, so the address answers instead.
    expect(userDisplayName({ name: "mt0grbxoqx7nbf", email: "admin@organza.test" })).toBe("admin");
    expect(userDisplayName({ name: "", email: "manager@organza.test" })).toBe("manager");
    // Nothing usable at all — the caller shows the role, which it translates.
    expect(userDisplayName({ name: null, email: null })).toBeNull();
    expect(userDisplayName(null)).toBeNull();
  });

  it("takes the avatar's letter from whatever is actually shown", () => {
    expect(userInitial({ name: "Suhaib", email: "s@x.test" })).toBe("S");
    // Not "M" from the id: the circle and the name beside it agree.
    expect(userInitial({ name: "mt0grbxoqx7nbf", email: "admin@organza.test" })).toBe("A");
    expect(userInitial({ name: "سهيب", email: null })).toBe("س");
    // Nothing to go on, so the caller's translated role supplies the letter.
    expect(userInitial(null, "مدير")).toBe("م");
    expect(userInitial(null)).toBe("?");
  });
});
