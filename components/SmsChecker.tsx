"use client";

import { useId, useState } from "react";
import { MAX_MESSAGE_CHARS, type SmsCheckResponse } from "@/lib/contracts";
import { isSmsResponse, postJson } from "./api";
import styles from "./SmsChecker.module.css";

const EXAMPLE = "Uw KBC-app vervalt vandaag, klik hier om te verlengen";
const VERDICT_CLASS = { phishing: styles.phishing, verdacht: styles.verdacht, veilig: styles.veilig } as const;
const VERDICT_LABEL = { phishing: "Phishing", verdacht: "Verdacht", veilig: "Veilig" } as const;

export function SmsChecker() {
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SmsCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (busy || text.trim().length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await postJson("/api/sms", { text: text.trim() }, isSmsResponse);
    if (r.ok) setResult(r.data);
    else setError(r.error);
    setBusy(false);
  }

  return (
    <section className={styles.panel} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className={styles.h}>Doorgestuurde sms</h2>
      <label htmlFor={`${id}-t`} className={styles.label}>Plak hier een verdachte sms</label>
      <textarea
        id={`${id}-t`}
        className={styles.textarea}
        rows={3}
        maxLength={MAX_MESSAGE_CHARS}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.row}>
        <button type="button" className={styles.primary} disabled={busy || text.trim().length === 0} onClick={check}>
          {busy ? "Controleren…" : "Controleer sms"}
        </button>
        <button type="button" className={styles.secondary} onClick={() => setText(EXAMPLE)}>
          Voorbeeld invullen
        </button>
      </div>
      <div aria-live="polite">
        {error ? <p className={styles.error}>{error}</p> : null}
        {result ? (
          <div className={styles.result}>
            <span className={`${styles.badge} ${VERDICT_CLASS[result.verdict]}`}>{VERDICT_LABEL[result.verdict]}</span>{" "}
            <span className={styles.score}>score {Math.round(result.score * 100)}%</span>
            <ul className={styles.reasons}>
              {result.reasons.map((r, i) => (
                <li key={`${i}-${r}`}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
