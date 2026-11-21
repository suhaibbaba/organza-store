"use client";

import { useTranslations } from "next-intl";
import { Section } from "@store/ui";
import { ORDER_FORM_SECTIONS } from "@/constants/orders";
import type { OrderFormSectionProps } from "@/types/order";

export function OrderFormSection({ name, forceOpen, children }: OrderFormSectionProps) {
  const t = useTranslations("orders.new.sections");
  const { icon, tone } = ORDER_FORM_SECTIONS[name];

  return (
    <Section
      data-testid={`order-form-${name}`}
      title={t(`${name}.title`)}
      description={t(`${name}.description`)}
      icon={icon}
      tone={tone}
      collapsible
      forceOpen={forceOpen}
    >
      {children}
    </Section>
  );
}
