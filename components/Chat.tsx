"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  DOMAIN_LABELS_NL,
  type ChatResponse,
  type ChatTurn,
  type Domain,
  type Mode,
} from "@/lib/contracts";
import { isChatResponse, postJson } from "./api";
import { Interventions } from "./Interventions";
import { MetaChips } from "./MetaChips";
import { ModeToggle } from "./ModeToggle";
import styles from "./Chat.module.css";
import { KateIcon } from "./KateLogo";

type Outcome = { ok: true; data: ChatResponse } | { ok: false; error: string };

type Item =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; mode: Mode; outcome: Outcome }
  | { id: string; kind: "compare"; baseline: Outcome; plus: Outcome };

const SUGGESTIONS = [
  "Waarom staat mijn rekening lager dan normaal?",
  "Iemand van de bank belde, ik moet mijn spaargeld naar een veilige rekening overzetten",
  "Mon salaire n'est pas encore arrivé ?",
  "My card was declined abroad",
];

function toTurns(items: Item[], text: string): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const it of items) {
    if (it.kind === "user") turns.push({ role: "user", content: it.text });
    else if (it.kind === "assistant") {
      if (it.outcome.ok && it.outcome.data.reply.trim()) turns.push({ role: "assistant", content: it.outcome.data.reply });
    } else {
      const o = it.plus.ok ? it.plus : it.baseline;
      if (o.ok && o.data.reply.trim()) turns.push({ role: "assistant", content: o.data.reply });
    }
  }
  turns.push({ role: "user", content: text });
  return turns.slice(-MAX_HISTORY_TURNS).map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }));
}

async function ask(mode: Mode, messages: ChatTurn[]): Promise<Outcome> {
  const r = await postJson("/api/chat", { mode, messages }, isChatResponse);
  return r;
}

export function Chat() {
  const [mode, setMode] = useState<Mode>("plus");
  const [compare, setCompare] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [items, loading]);

  async function send(raw: string, sendMode: Mode = mode) {
    const text = raw.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text || loading) return;
    const messages = toTurns(items, text);
    setItems((prev) => [...prev, { id: crypto.randomUUID(), kind: "user", text }]);
    setInput("");
    setLoading(true);
    if (compare) {
      const [baseline, plus] = await Promise.all([ask("baseline", messages), ask("plus", messages)]);
      setItems((prev) => [...prev, { id: crypto.randomUUID(), kind: "compare", baseline, plus }]);
    } else {
      const outcome = await ask(sendMode, messages);
      setItems((prev) => [...prev, { id: crypto.randomUUID(), kind: "assistant", mode: sendMode, outcome }]);
    }
    setLoading(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  function clarify(domain: Domain, answerMode: Mode) {
    void send(`Het gaat over ${DOMAIN_LABELS_NL[domain]}`, answerMode);
  }

  function renderOutcome(o: Outcome, label?: string) {
    if (!o.ok) {
      return <div className={styles.error} role="alert">{o.error}</div>;
    }
    const d = o.data;
    return (
      <div>
        <div className={styles.assistantLine}>
          <KateIcon size={34} />
          <div className={styles.assistant}>
            {label ? <div className={styles.label}>{label}</div> : null}
            <p className={styles.text}>{d.reply}</p>
          </div>
        </div>
        <MetaChips meta={d.meta} />
        {d.meta.interventions.length > 0 ? (
          <Interventions items={d.meta.interventions} disabled={loading} onClarify={(dom) => clarify(dom, d.meta.mode)} />
        ) : null}
      </div>
    );
  }

  function diffLine(b: Outcome, p: Outcome): string | null {
    if (!b.ok || !p.ok) return null;
    const bt = b.data.meta.inputTokens;
    const pt = p.data.meta.inputTokens;
    if (bt <= 0) return null;
    const pct = Math.round(((bt - pt) / bt) * 100);
    return pct >= 0 ? `Kate+ gebruikte ${pct}% minder inputtokens` : `Kate+ gebruikte ${-pct}% meer inputtokens`;
  }

  return (
    <section className={styles.chat} aria-label="Chat">
      <div className={styles.controls}>
        <ModeToggle value={mode} onChange={setMode} />
        <label className={styles.switch}>
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          Vergelijkingsmodus
        </label>
      </div>

      <div className={styles.list} aria-live="polite" aria-label="Berichten">
        {items.length === 0 ? <p className={styles.empty}>Stel een vraag aan Kate+, of kies een voorbeeld.</p> : null}
        {items.map((it) => {
          if (it.kind === "user") {
            return (
              <div key={it.id} className={styles.userRow}>
                <div className={styles.user}><p className={styles.text}>{it.text}</p></div>
              </div>
            );
          }
          if (it.kind === "assistant") {
            return <div key={it.id} className={styles.assistantRow}>{renderOutcome(it.outcome)}</div>;
          }
          const diff = diffLine(it.baseline, it.plus);
          return (
            <div key={it.id} className={styles.compareRow}>
              <div className={styles.compareGrid}>
                <div>{renderOutcome(it.baseline, "Baseline")}</div>
                <div>{renderOutcome(it.plus, "Kate+")}</div>
              </div>
              {diff ? <p className={styles.diff}>{diff}</p> : null}
            </div>
          );
        })}
        {loading ? <p className={styles.thinking}>Kate+ denkt na…</p> : null}
        <div ref={endRef} />
      </div>

      <div className={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className={styles.suggestion} disabled={loading} onClick={() => void send(s)}>
            {s}
          </button>
        ))}
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor={inputId} className={styles.srOnly}>Uw bericht</label>
        <textarea
          id={inputId}
          className={styles.textarea}
          rows={2}
          maxLength={MAX_MESSAGE_CHARS}
          value={input}
          disabled={loading}
          placeholder="Typ uw vraag…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className={styles.formRow}>
          <span className={styles.counter}>{input.length}/{MAX_MESSAGE_CHARS}</span>
          <button type="submit" className={styles.send} disabled={loading || input.trim().length === 0}>
            Verstuur
          </button>
        </div>
      </form>
    </section>
  );
}
