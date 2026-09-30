import styles from "./KateLogo.module.css";

/** Kate "voice" mark: soft blue ring with five rounded bars (recreated as SVG). */
export function KateIcon({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg
      className={styles.icon}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle cx="50" cy="50" r="47" fill="#e8f4fc" stroke="#b7dcf4" strokeWidth="5" />
      <circle cx="50" cy="50" r="38" fill="#f6fbfe" />
      <g fill="#0a9fe0">
        <rect x="40" y="25.5" width="12.5" height="5.5" rx="2.75" />
        <rect x="30.5" y="36" width="25.5" height="5.5" rx="2.75" />
        <rect x="25" y="46.8" width="50" height="5.5" rx="2.75" />
        <rect x="44.5" y="57.6" width="25" height="5.5" rx="2.75" />
        <rect x="47.8" y="68.2" width="12.5" height="5.5" rx="2.75" />
      </g>
    </svg>
  );
}

/** Full lockup: icon + "Kate" wordmark + "+" and optional suffix (e.g. "dashboard"). */
export function KateLogo({ suffix, as: Tag = "h1" }: { suffix?: string; as?: "h1" | "div" }) {
  return (
    <Tag className={styles.lockup}>
      <KateIcon size={46} />
      <span className={styles.word}>
        Kate<span className={styles.plus}>+</span>
        {suffix ? <span className={styles.suffix}> {suffix}</span> : null}
      </span>
    </Tag>
  );
}
