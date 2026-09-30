import { z } from "zod";

export const DOMAINS = [
  "betalingen",
  "kaarten",
  "sparen_beleggen",
  "kredieten",
  "verzekeringen",
  "app_beveiliging",
  "loon_hr",
  "onduidelijk",
] as const;

export type Domain = (typeof DOMAINS)[number];
export const DomainSchema = z.enum(DOMAINS);

export const DOMAIN_LABELS_NL: Readonly<Record<Domain, string>> = {
  betalingen: "Betalingen",
  kaarten: "Kaarten",
  sparen_beleggen: "Sparen & beleggen",
  kredieten: "Kredieten",
  verzekeringen: "Verzekeringen",
  app_beveiliging: "App & beveiliging",
  loon_hr: "Loon & HR",
  onduidelijk: "Onduidelijk",
};

export const LANGUAGES = ["nl", "fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LanguageSchema = z.enum(LANGUAGES);

/** Score in [0, 1]. Shared by classifier and signal schemas. */
export const ScoreSchema = z.number().min(0).max(1);
