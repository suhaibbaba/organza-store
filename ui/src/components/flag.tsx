import type { PhoneCountry } from "@ui/lib/support";
import { AE, BH, DE, EG, GB, IL, IQ, JO, KW, LB, OM, PS, QA, SA, SY, TR, US } from "country-flag-icons/react/3x2";
import type { JSX } from "react";
import { cn } from "@ui/lib/cn";

const FLAGS: Record<PhoneCountry, typeof PS> = {
  PS,
  IL,
  JO,
  EG,
  SA,
  AE,
  QA,
  KW,
  BH,
  OM,
  LB,
  SY,
  IQ,
  TR,
  GB,
  DE,
  US,
};

export function Flag({
  country,
  className,
}: {
  readonly country: PhoneCountry;
  readonly className?: string | undefined;
}): JSX.Element {
  const Svg = FLAGS[country];

  return <Svg aria-hidden="true" className={cn("h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-line", className)} />;
}
