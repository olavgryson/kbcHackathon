import { z } from "zod";
import { SignalSchema } from "./signals.ts";
import type { SmsVerdict } from "./classifier.ts";
import { MAX_MESSAGE_CHARS } from "./chat.ts";

export const NotificationsResponseSchema = z
  .object({
    /** Enkel signalen met notify=true. */
    notifications: z.array(SignalSchema),
    /** Aantal kandidaten vóór de notify-beslissing. */
    candidates: z.number().int().nonnegative(),
  })
  .strict();
export type NotificationsResponse = z.infer<typeof NotificationsResponseSchema>;

export const SmsCheckRequestSchema = z
  .object({ text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) })
  .strict();
export type SmsCheckRequest = z.infer<typeof SmsCheckRequestSchema>;

export type SmsCheckResponse = SmsVerdict;
