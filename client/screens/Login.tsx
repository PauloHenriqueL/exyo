import { useState, type FormEvent } from "react";
import { login, type Session } from "../net";

export function Login({ roomCode, error, onLogin }: { roomCode: string; error: string | null; onLogin: (s: Session) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(error);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      onLogin(await login(name, phone));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Falha no login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="center">
      <form className="panel login" onSubmit={submit}>
        <h1>Conselho do Rei</h1>
        <p className="muted">
          Sala <strong>{roomCode}</strong>. O Rei convoca seus conselheiros.
        </p>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required autoFocus />
        </label>
        <label>
          Telefone (com DDD)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(31) 99999-9999" required />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar no salão"}
        </button>
        <p className="hint">O telefone só serve para você voltar ao seu lugar se a página fechar.</p>
      </form>
    </main>
  );
}
