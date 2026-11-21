import { VALIDATION_CODE } from "@ui/lib/support";
import type { FieldError } from "react-hook-form";

const NOTHING_GIVEN = /to have >=1 (characters|items)$/;

const CODED: Readonly<Record<string, string>> = {
  [VALIDATION_CODE.YEAR_OUT_OF_RANGE]: "ui.validation.yearOutOfRange",
  [VALIDATION_CODE.DATE_IN_FUTURE]: "ui.validation.dateInFuture",
  [VALIDATION_CODE.DATE_IN_PAST]: "ui.validation.dateInPast",
};

export function validationMessageKey(error: FieldError | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  const coded = error.message === undefined ? undefined : CODED[error.message];

  if (coded) {
    return coded;
  }

  switch (error.type) {
    case "too_small":
      return NOTHING_GIVEN.test(error.message ?? "") ? "ui.validation.required" : "ui.validation.tooSmall";
    case "too_big":
      return "ui.validation.tooBig";
    case "invalid_type":
      return "ui.validation.required";
    case "invalid_format":
    case "invalid_string":
      return "ui.validation.invalidFormat";
    case "invalid_value":
    case "invalid_enum_value":
      return "ui.validation.invalid";
    default:
      return "ui.validation.invalid";
  }
}
