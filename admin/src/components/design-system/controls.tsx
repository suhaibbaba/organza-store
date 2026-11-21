"use client";

import { useState } from "react";
import { DESIGN_SYSTEM_COLOURS } from "@/constants/design-system";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  CardButton,
  IconButton,
  OutboundLink,
  Typography,
  Checkbox,
  Chip,
  ChipGroup,
  DatePicker,
  DateRangePicker,
  FormField,
  Icon,
  Input,
  MoneyInput,
  PasswordInput,
  PhoneInput,
  QuantityInput,
  RadioGroup,
  SearchField,
  SegmentedControl,
  Select,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  TimePicker,
  TranslatedField,
  Section,
  type DateRange,
} from "@store/ui";
import { SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import { LOCALE_LABELS } from "@/constants/locale";
import { useSettingsQuery } from "@/hooks/use-settings";
import { ShowcaseRow, ShowcaseSection } from "@/components/design-system/showcase-section";

const CHANNELS = ["counter", "whatsapp", "online"] as const;
const DISCOUNTS = ["percent", "amount"] as const;
const ORDER_TABS = ["open", "delivered", "returned"] as const;

type Channel = (typeof CHANNELS)[number];
type Discount = (typeof DISCOUNTS)[number];
type OrderTab = (typeof ORDER_TABS)[number];

const DS_LANGUAGES = SUPPORTED_LANGUAGES.map((code) => ({ code, name: LOCALE_LABELS[code] }));

export function Controls() {
  const t = useTranslations("designSystem");
  const currency = useSettingsQuery().data?.currency;

  const [chip, setChip] = useState("all");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("180");
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("");
  const [colour, setColour] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [channel, setChannel] = useState<Channel>("counter");
  const [discount, setDiscount] = useState<Discount>("percent");
  const [tab, setTab] = useState<OrderTab>("open");
  const [trackStock, setTrackStock] = useState(true);
  const [printLabel, setPrintLabel] = useState(false);
  const [giftWrap, setGiftWrap] = useState(true);

  return (
    <>
      <ShowcaseSection id="buttons" title={t("sections.buttons")} hint={t("hints.buttons")}>
        <ShowcaseRow>
          <Button variant="primary">{t("buttons.primary")}</Button>
          <Button variant="secondary">{t("buttons.secondary")}</Button>
          <Button variant="ghost">{t("buttons.ghost")}</Button>
          <Button variant="quiet">{t("buttons.quiet")}</Button>
          <Button variant="danger">{t("buttons.danger")}</Button>
        </ShowcaseRow>
        <ShowcaseRow>
          <Button variant="primary" isLoading>
            {t("buttons.loading")}
          </Button>
          <Button variant="secondary" disabled>
            {t("buttons.disabled")}
          </Button>
          <Button variant="primary" icon={<Icon name="plus" />}>
            {t("buttons.withIcon")}
          </Button>
          <Button variant="secondary" size="sm">
            {t("buttons.small")}
          </Button>
          <IconButton label={t("buttons.iconDelete")} icon={<Icon name="trash" />} tone="danger" />
          <IconButton label={t("buttons.iconClose")} icon={<Icon name="x" />} />
          <OutboundLink href="https://www.google.com/maps">{t("buttons.outbound")}</OutboundLink>
        </ShowcaseRow>
        <ShowcaseRow>
          <CardButton className="w-44 flex-col gap-1 p-3">
            <Typography variant="small" as="span">{t("buttons.card")}</Typography>
            <Typography variant="caption" tone="muted">{t("buttons.cardHint")}</Typography>
          </CardButton>
          <CardButton selected className="w-44 flex-col gap-1 p-3">
            <Typography variant="small" as="span">{t("buttons.cardSelected")}</Typography>
            <Typography variant="caption" tone="muted">{t("buttons.cardHint")}</Typography>
          </CardButton>
        </ShowcaseRow>
      </ShowcaseSection>

      <ShowcaseSection id="badges" title={t("sections.badges")} hint={t("hints.badges")}>
        <ShowcaseRow>
          <Badge tone="success" icon="check">
            {t("badges.inStock")}
          </Badge>
          <Badge tone="warning" icon="alert">
            {t("badges.lowStock")}
          </Badge>
          <Badge tone="danger">{t("badges.soldOut")}</Badge>
          <Badge tone="info">{t("badges.new")}</Badge>
          <Badge tone="neutral">{t("badges.gift")}</Badge>
          <Badge tone="wash">{t("badges.new")}</Badge>
        </ShowcaseRow>
        <ShowcaseRow>
          {(["all", "dresses", "shawls"] as const).map((key) => (
            <Chip key={key} selected={chip === key} onClick={() => setChip(key)}>
              {t(`badges.${key}`)}
            </Chip>
          ))}
        </ShowcaseRow>
        <ShowcaseRow>
          <ChipGroup>
            {(["dresses", "shawls"] as const).map((key) => (
              <Chip key={key} onRemove={() => undefined} removeLabel={t("chips.remove", { name: t(`badges.${key}`) })}>
                {t(`badges.${key}`)}
              </Chip>
            ))}
          </ChipGroup>
        </ShowcaseRow>
      </ShowcaseSection>

      <ShowcaseSection id="fields" title={t("sections.fields")} hint={t("hints.fields")}>
        <SearchField
          label={t("fields.search")}
          placeholder={t("fields.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="designSystem.fields.name" htmlFor="ds-name" hint="designSystem.fields.nameHint">
            <Input
              id="ds-name"
              placeholder={t("fields.namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onClear={() => setName("")}
            />
          </FormField>
          <FormField label="designSystem.fields.category" htmlFor="ds-category">
            <Select
              id="ds-category"
              placeholder={t("fields.categoryPlaceholder")}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              options={[
                { value: "dresses", label: t("badges.dresses") },
                { value: "shawls", label: t("badges.shawls") },
              ]}
            />
          </FormField>
          <FormField label="designSystem.fields.colour" hint="designSystem.fields.colourHint" htmlFor="ds-colour">
            <Select
              id="ds-colour"
              placeholder={t("fields.colourPlaceholder")}
              value={colour}
              onChange={(event) => setColour(event.target.value)}
              options={DESIGN_SYSTEM_COLOURS.map((key) => ({ value: key, label: t(`colours.${key}`) }))}
            />
          </FormField>
          <FormField label="designSystem.fields.price" htmlFor="ds-price">
            <MoneyInput
              id="ds-price"
              currency={currency}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </FormField>
          <FormField label="designSystem.fields.quantity" htmlFor="ds-quantity">
            <QuantityInput id="ds-quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </FormField>
          <FormField label="designSystem.fields.phone" htmlFor="ds-phone">
            <PhoneInput id="ds-phone" value={phone} onChange={setPhone} />
          </FormField>
          <FormField label="designSystem.fields.password" htmlFor="ds-password">
            <PasswordInput id="ds-password" autoComplete="new-password" />
          </FormField>
          <FormField label="designSystem.fields.date" htmlFor="ds-date">
            <DatePicker id="ds-date" label={t("fields.date")} value={date} onChange={setDate} />
          </FormField>
          <FormField label="designSystem.fields.time" htmlFor="ds-time">
            <TimePicker id="ds-time" label={t("fields.time")} value={time} onChange={setTime} />
          </FormField>
          <FormField label="designSystem.fields.range" htmlFor="ds-range">
            <DateRangePicker id="ds-range" label={t("fields.range")} value={range} onChange={setRange} />
          </FormField>
          <FormField
            label="designSystem.fields.error"
            htmlFor="ds-error"
            errorKey="designSystem.fields.errorHint"
            error={{ type: "required" }}
          >
            <Input id="ds-error" hasError aria-invalid />
          </FormField>
          <FormField label="designSystem.fields.disabled" htmlFor="ds-disabled">
            <Input id="ds-disabled" disabled value={t("fields.namePlaceholder")} readOnly />
          </FormField>
          <FormField label="designSystem.fields.notes" htmlFor="ds-notes" optional>
            <Textarea id="ds-notes" placeholder={t("fields.notesPlaceholder")} rows={3} />
          </FormField>
          <Section
            data-testid="ds-section"
            title={t("fields.sectionTitle")}
            description={t("fields.sectionDescription")}
            icon="layers"
            tone="green"
            collapsible
          >
            <Input id="ds-section-field" aria-label={t("fields.sectionTitle")} placeholder={t("fields.namePlaceholder")} />
          </Section>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-label text-ink">{t("fields.translated")}</legend>
            <TranslatedField
              data-testid="ds-translated"
              languages={DS_LANGUAGES}
              values={translated}
              controlProps={(code) => ({
                "aria-label": `${t("fields.translated")} — ${code}`,
                value: translated[code] ?? "",
                onChange: (event) => setTranslated((previous) => ({ ...previous, [code]: event.target.value })),
              })}
            />
          </fieldset>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="choices" title={t("sections.choices")} hint={t("hints.choices")}>
        <ShowcaseRow label={t("choices.channel")}>
          <SegmentedControl
            label={t("choices.channel")}
            value={channel}
            onChange={setChannel}
            options={CHANNELS.map((value) => ({ value, label: t(`choices.${value}`) }))}
          />
        </ShowcaseRow>
        <ShowcaseRow label={t("choices.discount")}>
          <RadioGroup
            label={t("choices.discount")}
            value={discount}
            onChange={setDiscount}
            options={DISCOUNTS.map((value) => ({ value, label: t(`choices.${value}`) }))}
          />
        </ShowcaseRow>
        <ShowcaseRow>
          <Switch label={t("choices.trackStock")} checked={trackStock} onCheckedChange={setTrackStock} />
          <Checkbox label={t("choices.printLabel")} checked={printLabel} onCheckedChange={setPrintLabel} />
          <Checkbox label={t("choices.giftWrap")} checked={giftWrap} onCheckedChange={setGiftWrap} />
          <Switch size="sm" label={t("choices.trackStock")} checked={trackStock} onCheckedChange={setTrackStock} />
          <Checkbox size="sm" label={t("choices.printLabel")} checked={printLabel} onCheckedChange={setPrintLabel} />
        </ShowcaseRow>
        <div className="flex flex-col gap-3">
          <Tabs
            label="designSystem.choices.tabs"
            value={tab}
            onChange={setTab}
            tabs={ORDER_TABS.map((id, index) => ({ id, label: `designSystem.choices.${id}`, count: 3 - index }))}
          />
          {ORDER_TABS.map((id) => (
            <TabPanel key={id} id={id}>
              {tab === id && <p className="text-value text-ink-muted">{t(`choices.${id}`)}</p>}
            </TabPanel>
          ))}
        </div>
      </ShowcaseSection>
    </>
  );
}
