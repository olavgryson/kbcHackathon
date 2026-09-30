"use client";

import type { Mode } from "@/lib/contracts";
import styles from "./ModeToggle.module.css";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "baseline", label: "Baseline" },
  { value: "plus", label: "Kate+" },
];

export function ModeToggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className={styles.group} role="radiogroup" aria-label="Modus">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? styles.active : styles.option}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
