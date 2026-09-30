import Link from "next/link";
import { DOMAINS, DOMAIN_LABELS_NL, LANGUAGES, type Domain, type Language } from "@/lib/contracts";
import { loadResults } from "./loadResults";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const LANG_LABELS: Record<Language, string> = { nl: "Nederlands", fr: "Frans", en: "Engels" };
const SHORT_LABELS: Record<Domain, string> = {
  betalingen: "Betal.",
  kaarten: "Kaarten",
  sparen_beleggen: "Sparen",
  kredieten: "Krediet",
  verzekeringen: "Verz.",
  app_beveiliging: "App",
  loon_hr: "Loon",
  onduidelijk: "Onduid.",
};
const INTERVENTION_LABELS = {
  scam_warning: "Scamwaarschuwing",
  handover: "Overdracht naar mens",
  clarify: "Verduidelijkende vraag",
} as const;

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const num = (n: number) => Math.round(n).toLocaleString("nl-BE");

function level(n: number): string {
  if (n === 0) return "l0";
  if (n <= 2) return "l1";
  if (n <= 5) return "l2";
  if (n <= 10) return "l3";
  return "l4";
}

function Bar({ label, value, max, text, cls }: { label: string; value: number; max: number; text: string; cls?: string }) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <svg className={styles.bar} viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={`${label}: ${text}`}>
        <rect className={styles.track} x="0" y="0" width="100" height="10" rx="2" />
        <rect className={cls ?? styles.fill} x="0" y="0" width={width} height="10" rx="2" />
      </svg>
      <span className={styles.barValue}>{text}</span>
    </div>
  );
}

export default async function DashboardPage() {
  const r = await loadResults();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            Kate<span className={styles.plus}>+</span> dashboard
          </h1>
          <p className={styles.sub}>Evaluatieresultaten · synthetische data</p>
        </div>
        <Link href="/" className={styles.back}>Terug naar de chat</Link>
      </header>

      {!r ? (
        <main className={styles.empty}>
          <h2>Nog geen evaluatieresultaten.</h2>
          <p>
            Draai <code>npm run eval</code>.
          </p>
        </main>
      ) : (
        <main className={styles.grid}>
          <section className={styles.kpis} aria-label="Kerncijfers">
            <div className={styles.kpi}><span>Routeringsaccuraatheid</span><strong>{pct(r.accuracy)}</strong></div>
            <div className={styles.kpi}><span>Aantal vragen</span><strong>{num(r.total)}</strong></div>
            <div className={styles.kpi}><span>Classifierbron</span><strong>{r.classifier === "local" ? "Lokaal (jeff)" : "Fallback"}</strong></div>
            <div className={styles.kpi}>
              <span>Gegenereerd op</span>
              <strong className={styles.small}>
                {Number.isNaN(Date.parse(r.generatedAt)) ? r.generatedAt : new Date(r.generatedAt).toLocaleString("nl-BE")}
              </strong>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="h-lang">
            <h2 id="h-lang">Accuraatheid per taal</h2>
            {LANGUAGES.map((l) => (
              <Bar
                key={l}
                label={LANG_LABELS[l]}
                value={r.perLanguage[l].accuracy}
                max={1}
                text={`${pct(r.perLanguage[l].accuracy)} (${r.perLanguage[l].correct}/${r.perLanguage[l].total})`}
              />
            ))}
          </section>

          <section className={styles.card} aria-labelledby="h-tok">
            <h2 id="h-tok">Gemiddelde inputtokens ({r.tokens.measured === "live" ? "live" : "geschat"})</h2>
            <Bar label="Baseline" value={r.tokens.baselineAvg} max={Math.max(r.tokens.baselineAvg, r.tokens.plusAvg)} text={num(r.tokens.baselineAvg)} cls={styles.fillMuted} />
            <Bar label="Kate+" value={r.tokens.plusAvg} max={Math.max(r.tokens.baselineAvg, r.tokens.plusAvg)} text={num(r.tokens.plusAvg)} />
            {r.tokens.baselineAvg > 0 && (
              <p className={styles.highlight}>
                {(() => {
                  const d = Math.round((1 - r.tokens.plusAvg / r.tokens.baselineAvg) * 100);
                  return d >= 0 ? `${d}% minder` : `${-d}% meer`;
                })()}{" "}
                inputtokens met Kate+
              </p>
            )}
          </section>

          <section className={styles.card} aria-labelledby="h-int">
            <h2 id="h-int">Ingrepen per type</h2>
            {(Object.keys(INTERVENTION_LABELS) as (keyof typeof INTERVENTION_LABELS)[]).map((k) => (
              <Bar
                key={k}
                label={INTERVENTION_LABELS[k]}
                value={r.interventions[k]}
                max={Math.max(1, ...Object.values(r.interventions))}
                text={num(r.interventions[k])}
              />
            ))}
          </section>

          <section className={styles.card} aria-labelledby="h-sig">
            <h2 id="h-sig">Proactieve signalen</h2>
            <Bar label="Precision" value={r.signals.precision} max={1} text={pct(r.signals.precision)} />
            <Bar label="Recall" value={r.signals.recall} max={1} text={pct(r.signals.recall)} />
            <p className={styles.counts}>
              Juist positief (tp): <strong>{r.signals.tp}</strong> · Fout positief (fp): <strong>{r.signals.fp}</strong> · Gemist (fn): <strong>{r.signals.fn}</strong>
            </p>
          </section>

          <section className={`${styles.card} ${styles.wide}`} aria-labelledby="h-conf">
            <h2 id="h-conf">Confusion matrix</h2>
            <p className={styles.hint}>Rijen: verwacht domein · kolommen: voorspeld domein. Groen = juist, rood = fout.</p>
            <div className={styles.tableWrap}>
              <table className={styles.matrix}>
                <caption className={styles.srOnly}>Aantal vragen per verwacht en voorspeld domein</caption>
                <thead>
                  <tr>
                    <th scope="col">Verwacht \ voorspeld</th>
                    {DOMAINS.map((d) => (
                      <th key={d} scope="col" title={DOMAIN_LABELS_NL[d]}>{SHORT_LABELS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DOMAINS.map((e) => (
                    <tr key={e}>
                      <th scope="row">{DOMAIN_LABELS_NL[e]}</th>
                      {DOMAINS.map((p) => {
                        const n = r.confusion[e][p];
                        return (
                          <td key={p} className={styles[`${e === p ? "ok" : "bad"}_${level(n)}`]}>
                            {n}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
