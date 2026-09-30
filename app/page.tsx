import Link from "next/link";
import { Chat } from "@/components/Chat";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { SmsChecker } from "@/components/SmsChecker";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.logo}>
            Kate<span className={styles.plus}>+</span>
          </h1>
          <p className={styles.sub}>PoC · synthetische data (persona Sofie)</p>
        </div>
        <Link href="/dashboard" className={styles.dash}>Dashboard</Link>
      </header>
      <main className={styles.layout}>
        <Chat />
        <aside className={styles.side} aria-label="Meldingen en sms-controle">
          <NotificationsPanel />
          <SmsChecker />
        </aside>
      </main>
    </div>
  );
}
