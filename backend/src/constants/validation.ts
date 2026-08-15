export * from "@organza/shared/constants/validation";

/**
 * What a rejected unknown field says in the ZodError's details.
 *
 * NOT user-facing and deliberately not a translation key (CLAUDE.md rule 12
 * governs what reaches a screen): the envelope's `error.validation` is what
 * the frontend renders, and this only ever appears in the details array
 * alongside the path — a developer's clue about a body that was built wrong,
 * next to `error.validation`'s "check what you typed" for the person.
 */
export const UNKNOWN_FIELD_MESSAGE = "Unrecognized field";
