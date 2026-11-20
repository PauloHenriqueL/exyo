import { useRef, useState } from "react";
import type { Room } from "colyseus.js";

/** Atalhos: os símbolos dos recursos e algumas reações, para falar rápido durante o debate. */
const QUICK = ["✚", "🛡", "⚔", "🌾", "🪙", "▲", "▼", "👍", "👎", "🤝", "👑", "🗡", "?", "!"];

/** Chat dos jogadores: a mensagem aparece por alguns segundos no balão ao lado do brasão de quem falou. */
export function ChatBox({ room }: { room: Room }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const send = (t: string) => {
    const msg = t.trim();
    if (!msg) return;
    room.send("chat", { text: msg });
    setText("");
    input.current?.focus();
  };

  if (!open) {
    return (
      <button
        className="btn chat-toggle"
        onClick={() => {
          setOpen(true);
          setTimeout(() => input.current?.focus(), 0);
        }}
      >
        💬 Falar com o conselho
      </button>
    );
  }

  return (
    <form
      className="panel chatbox"
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
    >
      <div className="chat-quick" aria-label="Atalhos">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            className="quick"
            onClick={() => {
              const next = (text + q).slice(0, 80);
              setText(next);
              // volta o foco ao campo com o cursor no fim, para continuar escrevendo depois do símbolo
              requestAnimationFrame(() => {
                input.current?.focus();
                input.current?.setSelectionRange(next.length, next.length);
              });
            }}
            aria-label={`Inserir ${q}`}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="chat-line">
        <label htmlFor="chat-text" className="sr-only">
          Mensagem
        </label>
        <input
          id="chat-text"
          ref={input}
          value={text}
          maxLength={80}
          placeholder="Ex.: 🌾▲ voto SIM se vocês protegerem a Comida"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn small" disabled={!text.trim()}>
          Enviar
        </button>
        <button type="button" className="btn small" onClick={() => setOpen(false)} aria-label="Fechar chat">
          ✕
        </button>
      </div>
    </form>
  );
}
