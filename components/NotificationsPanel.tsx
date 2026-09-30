"use client";

import { useEffect, useState } from "react";
import type { NotificationsResponse, Severity } from "@/lib/contracts";
import { getJson, isNotificationsResponse } from "./api";
import styles from "./NotificationsPanel.module.css";

const eur = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });
const SEV_CLASS: Record<Severity, string> = { info: styles.info ?? "", warning: styles.warning ?? "", critical: styles.critical ?? "" };
const SEV_LABEL: Record<Severity, string> = { info: "Info", warning: "Let op", critical: "Dringend" };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("nl-BE");
}

export function NotificationsPanel() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    getJson("/api/notifications", isNotificationsResponse).then((r) => {
      if (cancelled) return;
      if (r.ok) setData(r.data);
      else setError(r.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <details className={styles.panel} open>
      <summary className={styles.summary}>Meldingen</summary>
      <div className={styles.body}>
        {loading ? <p className={styles.muted}>Laden…</p> : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        {data ? (
          <>
            <p className={styles.muted}>
              {data.notifications.length} van {data.candidates} kandidaten gemeld
            </p>
            <ul className={styles.list}>
              {data.notifications.map((n) => (
                <li key={n.id} className={`${styles.item} ${SEV_CLASS[n.severity]}`}>
                  <div className={styles.head}>
                    <span className={styles.sev}>{SEV_LABEL[n.severity]}</span>
                    <span className={styles.date}>{formatDate(n.date)}</span>
                  </div>
                  <p className={styles.title}>{n.title}</p>
                  <p className={styles.amount}>{eur.format(n.amount)}</p>
                  <button
                    type="button"
                    className={styles.why}
                    aria-expanded={open[n.id] === true}
                    onClick={() => setOpen((o) => ({ ...o, [n.id]: !o[n.id] }))}
                  >
                    Waarom zie ik dit?
                  </button>
                  {open[n.id] ? <p className={styles.explain}>{n.explanation}</p> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </details>
  );
}
