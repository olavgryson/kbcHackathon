"use client";

import { useState } from "react";
import { DOMAIN_LABELS_NL, type Domain, type Intervention } from "@/lib/contracts";
import styles from "./Interventions.module.css";

export function Interventions({
  items,
  onClarify,
  disabled,
}: {
  items: Intervention[];
  onClarify: (domain: Domain) => void;
  disabled: boolean;
}) {
  const [requested, setRequested] = useState(false);
  return (
    <div className={styles.wrap}>
      {items.map((iv, i) => {
        if (iv.type === "scam_warning") {
          return (
            <section key={`${iv.type}-${i}`} className={styles.scam} role="alert">
              <h3 className={styles.title}>{iv.title}</h3>
              <p className={styles.text}>{iv.message}</p>
            </section>
          );
        }
        if (iv.type === "handover") {
          return (
            <section key={`${iv.type}-${i}`} className={styles.handover} aria-label="Doorverbinden">
              <h3 className={styles.title}>Doorverbinden met een medewerker</h3>
              <p className={styles.text}>{iv.summary}</p>
              <p className={styles.reason}>Reden: {iv.reason}</p>
              <button type="button" className={styles.btn} disabled={requested} onClick={() => setRequested(true)}>
                {requested ? "Aangevraagd (demo)" : "Verbind me door"}
              </button>
            </section>
          );
        }
        return (
          <section key={`${iv.type}-${i}`} className={styles.clarify} aria-label="Verduidelijking">
            <p className={styles.text}>{iv.question}</p>
            <div className={styles.options}>
              {iv.options.map((d) => (
                <button key={d} type="button" className={styles.btn} disabled={disabled} onClick={() => onClarify(d)}>
                  {DOMAIN_LABELS_NL[d]}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
