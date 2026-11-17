import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import type { ClientView } from "../shared/types";
import { joinRoom, loadSession, newRoomCode, roomCodeFromUrl, saveSession, type Session } from "./net";
import { Login } from "./screens/Login";
import { Lobby } from "./screens/Lobby";
import { Table } from "./screens/Table";
import { Final } from "./screens/Final";

export function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "lost">("idle");
  const roomRef = useRef<Room | null>(null);

  // Garante uma URL /sala/CODIGO compartilhável.
  const [roomCode] = useState(() => {
    const code = roomCodeFromUrl() ?? newRoomCode();
    if (!roomCodeFromUrl()) history.replaceState(null, "", `/sala/${code}`);
    return code;
  });

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = async () => {
      setStatus("connecting");
      try {
        const room = await joinRoom(roomCode, session.token, (v) => !cancelled && setView(v));
        if (cancelled) return room.leave();
        roomRef.current = room;
        setStatus("connected");
        setError(null);
        room.onLeave((code) => {
          if (cancelled || code === 4000) return; // 4000 = substituído por outra aba
          setStatus("lost");
          retry = setTimeout(connect, 2000);
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (msg.includes("Sessão inválida")) {
          saveSession(null);
          setSession(null);
        } else {
          setStatus("lost");
          retry = setTimeout(connect, 3000);
        }
      }
    };
    connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [session, roomCode]);

  if (!session) {
    return (
      <Login
        roomCode={roomCode}
        error={error}
        onLogin={(s) => {
          saveSession(s);
          setSession(s);
        }}
      />
    );
  }

  const room = roomRef.current;
  return (
    <>
      {status !== "connected" && (
        <div className="banner" role="status">
          {status === "lost" ? `Conexão perdida${error ? `: ${error}` : ""}. Tentando de novo…` : "Conectando à sala…"}
        </div>
      )}
      {view && room ? (
        view.phase === "lobby" ? (
          <Lobby view={view} room={room} />
        ) : view.phase === "end" ? (
          <Final view={view} />
        ) : (
          <Table view={view} room={room} />
        )
      ) : (
        <div className="center muted">Abrindo as portas do salão…</div>
      )}
    </>
  );
}
