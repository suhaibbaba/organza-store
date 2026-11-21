import type { JSX } from "react";
import { Icon } from "@ui/components/icon";
import { Ltr } from "@ui/components/ltr";
import { cn } from "@ui/lib/cn";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface ContactLinkProps extends TestIdProps {
  readonly value: string | null | undefined;
  readonly className?: string | undefined;
  readonly fallback?: JSX.Element | string | undefined;
}

const LINK_CLASS = cn(
  "text-primary-600 underline-offset-2 transition-colors duration-150",
  "hover:text-primary-700 hover:underline",
  "relative inline-block",
  "after:absolute after:inset-x-0 after:top-1/2 after:h-(--control-h) after:-translate-y-1/2 after:content-[''] lg:after:hidden",
);

export function PhoneLink({
  value,
  className,
  fallback = "—",
  "data-testid": testId,
}: ContactLinkProps): JSX.Element {
  if (value === null || value === undefined || value.trim() === "") {
    return <>{fallback}</>;
  }

  return (
    <Ltr
      as="a"
      data-part="phone-link"
      {...testid(testId)}
      href={`tel:${value.replace(/[^+\d]/g, "")}`}
      className={cn(LINK_CLASS, "tabular-nums", className)}
    >
      {value}
    </Ltr>
  );
}

export function EmailLink({
  value,
  className,
  fallback = "—",
  "data-testid": testId,
}: ContactLinkProps): JSX.Element {
  if (value === null || value === undefined || value.trim() === "") {
    return <>{fallback}</>;
  }

  return (
    <Ltr
      as="a"
      data-part="email-link"
      {...testid(testId)}
      href={`mailto:${value.trim()}`}
      className={cn(LINK_CLASS, className)}
    >
      {value}
    </Ltr>
  );
}

export interface WhatsAppLinkProps extends TestIdProps {
  readonly value: string | null | undefined;
  readonly label: string;
  readonly className?: string | undefined;
}

export function WhatsAppLink({
  value,
  label,
  className,
  "data-testid": testId,
}: WhatsAppLinkProps): JSX.Element | null {
  const digits = value?.trim().startsWith("+") ? value.replace(/\D/g, "") : "";

  if (digits === "") {
    return null;
  }

  return (
    <a
      data-part="whatsapp-link"
      {...testid(testId)}
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      title={value ?? undefined}
      className={cn(LINK_CLASS, "inline-flex items-center gap-1", className)}
    >
      <Icon name="whatsapp" className="size-4 shrink-0 text-success-700" />
      {label}
    </a>
  );
}
