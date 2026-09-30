import { DOMAIN_LABELS_NL, type ChatResponse } from "@/lib/contracts";
import { shortModel } from "./api";
import styles from "./MetaChips.module.css";

export function MetaChips({ meta }: { meta: ChatResponse["meta"] }) {
  return (
    <ul className={styles.chips} aria-label="Antwoordgegevens">
      <li className={meta.mode === "plus" ? styles.plus : styles.base}>{meta.mode === "plus" ? "Kate+" : "Baseline"}</li>
      {meta.domain ? <li className={styles.chip}>{DOMAIN_LABELS_NL[meta.domain]}</li> : null}
      {meta.confidence !== null ? <li className={styles.chip}>{Math.round(meta.confidence * 100)}% zeker</li> : null}
      <li className={styles.chip}>{shortModel(meta.model)}</li>
      <li className={styles.chip}>{meta.inputTokens} inputtokens</li>
      <li className={styles.chip}>{Math.round(meta.latencyMs)} ms</li>
      {meta.classifierSource ? <li className={styles.chip}>classifier: {meta.classifierSource}</li> : null}
      {meta.demo ? <li className={styles.demo}>demo</li> : null}
    </ul>
  );
}
