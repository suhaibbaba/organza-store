import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { isValidE164 } from "@store/shared/lib/phone";
import { ONLINE_ORDER_CHANNELS } from "@store/shared/constants/order";
import { DEFAULT_MANUAL_ORDER_CHANNEL, MANUAL_ORDER_CHANNELS } from "@/constants/orders";
import type { OrderCustomerDraft } from "@/types/order";

// Field messages are backend error codes (rule 12); contact details are checked only on an online order (ORDER_CUSTOMER_REQUIRED).
export const orderCustomerFormSchema = z
  .object({
    channel: z.enum(MANUAL_ORDER_CHANNELS),
    gift: z.boolean(),
    name: z.string(),
    phone: z.string(),
    hasWhatsapp: z.boolean(),
    whatsapp: z.string(),
    address: z.string(),
    location: z.string(),
    latitude: z.string(),
    longitude: z.string(),
    note: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!(ONLINE_ORDER_CHANNELS as readonly string[]).includes(v.channel)) {
      return;
    }
    const fail = (path: keyof typeof v, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (v.name.trim() === "") {
      fail("name", ERROR_CODES.VALIDATION_REQUIRED);
    }
    if (!isValidE164(v.phone)) {
      fail("phone", ERROR_CODES.VALIDATION_INVALID_PHONE);
    }
    if (v.hasWhatsapp && !isValidE164(v.whatsapp)) {
      fail("whatsapp", ERROR_CODES.VALIDATION_INVALID_PHONE);
    }
    // A pasted link only counts once its point has been read.
    if (v.location.trim() !== "" && (v.latitude === "" || v.longitude === "")) {
      fail("location", ERROR_CODES.ORDER_LOCATION_LINK_INVALID);
    }
  });

export type OrderCustomerFormValues = z.infer<typeof orderCustomerFormSchema>;

export const DEFAULT_ORDER_CUSTOMER_VALUES: OrderCustomerFormValues = {
  channel: DEFAULT_MANUAL_ORDER_CHANNEL,
  gift: false,
  name: "",
  phone: "",
  hasWhatsapp: false,
  whatsapp: "",
  address: "",
  location: "",
  latitude: "",
  longitude: "",
  note: "",
};

export function toCustomerDraft(values: OrderCustomerFormValues): OrderCustomerDraft {
  const { name, phone, hasWhatsapp, whatsapp, address, latitude, longitude, note } = values;
  return { name, phone, whatsapp: hasWhatsapp ? whatsapp : "", address, latitude, longitude, note };
}
