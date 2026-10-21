import React, { useEffect, useRef, useState } from "react";
import { openSocket } from "./api.js";
import { fmt } from "./format.js";

export default function Room({ session, code, go }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [copied, setCopied] = useState(false);
  const ws = useRef(null);
  const link = `${location.origin}/?room=${code}`;

  useEffect(() => {
    const sock = openSocket(`room/${code}/`, session.token);
    ws.current = sock;
    sock.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "room") setRoom(m.room);
      if (m.type === "match_found") go({ name: "game", id: m.match_id });
      if (m.type === "error") setError(m.message);
      if (m.type === "closed") setError("La room a été fermée.");
      if (m.type === "invite_sent") { setNote(`Invitation envoyée à ${m.username}.`); setWho(""); }
    };
    return () => sock.close();
    // eslint-disable-next-line
  }, [code]);

  const invite = (e) => {
    e.preventDefault();
    setError(""); setNote("");
    ws.current?.send(JSON.stringify({ action: "invite", username: who }));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };
  const isOwner = room && room.owner_id === room.members.find((m) => m.name === session.username)?.id;

  return (
    <main className="center">
      <div className="panel room">
        <header className="row between">
          <h1 className="logo small">ROOM</h1>
          <button className="ghost" onClick={() => go({ name: "lobby" })}>Quitter la room</button>
        </header>

        {!room ? (
          <p className="muted" style={{ marginTop: "1rem" }}>{error || "Connexion à la room…"}</p>
        ) : (
          <>
            <div className="codebox" aria-label="Code de la room">{code}</div>
            <button className="ghost wide" onClick={copy}>{copied ? "Lien copié ✓" : "Copier le lien d'invitation"}</button>

            <div className="preview">
              <div><span>Mise par joueur</span><b>{room.stake ? fmt(room.stake) : "Gratuit"}</b></div>
              {room.stake > 0 && <div className="win"><span>Gain du vainqueur</span><b>{fmt(room.bet.prize)}</b></div>}
            </div>

            <h2>Joueurs {room.members.length} / {room.size}</h2>
            <ul className="slots">
              {Array.from({ length: room.size }, (_, i) => {
                const m = room.members[i];
                return (
                  <li key={i} className={m ? "slot full" : "slot"}>
                    {m ? <>{m.name}{m.id === room.owner_id && <small>hôte</small>}</> : "En attente…"}
                  </li>
                );
              })}
            </ul>
            <p className="muted small">La partie démarre automatiquement quand la room est pleine.{isOwner ? "" : ` Hôte : ${room.owner}.`}</p>

            {room.members.length < room.size && (
              <form onSubmit={invite} className="row gap">
                <input className="grow" placeholder="Inviter un ami (pseudo)" value={who} onChange={(e) => setWho(e.target.value)} required />
                <button className="primary">Inviter</button>
              </form>
            )}
            {note && <p className="ok">{note}</p>}
            {error && <p className="error" role="alert">{error}</p>}
          </>
        )}
        {!room && error && <button className="primary wide" onClick={() => go({ name: "lobby" })}>Retour au salon</button>}
      </div>
    </main>
  );
}
