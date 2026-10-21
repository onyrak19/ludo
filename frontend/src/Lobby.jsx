import React, { useEffect, useRef, useState } from "react";
import { api, openSocket } from "./api.js";
import { fmt, preview } from "./format.js";
import TopBar from "./TopBar.jsx";

const PRESETS = [0, 1000, 2000, 5000, 10000];
const KINDS = { admin: "Ajustement", bonus: "Bonus", room_fee: "Frais de room", stake: "Mise", payout: "Gain", refund: "Remboursement" };

export default function Lobby({ session, go, onLogout }) {
  const token = session.token;
  const [tab, setTab] = useState("quick");
  const [me, setMe] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [size, setSize] = useState(2);
  const [stake, setStake] = useState(0);
  const [searching, setSearching] = useState(false);
  const [queue, setQueue] = useState(0);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState(null);
  const [code, setCode] = useState("");
  const [history, setHistory] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    api("me/", { token }).then(setMe).catch((e) => { if (/jeton|token|authent/i.test(e.message)) onLogout(); });
    api("settings/", { token }).then(setCfg).catch(() => {});
    api("transactions/", { token }).then(setHistory).catch(() => {});
    const sock = openSocket("matchmaking/", token);
    ws.current = sock;
    sock.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "match_found") go({ name: "game", id: m.match_id });
      if (m.type === "queue") setQueue(m.count);
      if (m.type === "cancelled") { setSearching(false); setQueue(0); }
      if (m.type === "error") { setError(m.message); setSearching(false); }
      if (m.type === "invite") setInvite(m);
    };
    sock.onclose = () => setError("Connexion au serveur perdue. Rechargez la page.");
    return () => sock.close();
    // eslint-disable-next-line
  }, []);

  const send = (d) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(d));
  const prev = cfg ? preview(stake, size, cfg.commission_percent) : null;
  let stakeError = "";
  if (cfg && stake > 0) {
    if (stake < cfg.min_stake || stake > cfg.max_stake) stakeError = `Mise entre ${fmt(cfg.min_stake)} et ${fmt(cfg.max_stake)}.`;
    else if (me && stake > me.balance) stakeError = "Solde insuffisant pour cette mise.";
  }

  const start = () => { setError(""); setSearching(true); setQueue(1); send({ action: "join", size, stake }); };
  const changeSize = (n) => { setSize(n); if (searching) { setQueue(1); send({ action: "join", size: n, stake }); } };

  async function createRoom() {
    setError("");
    try {
      const r = await api("rooms/", { method: "POST", token, body: { size, stake } });
      go({ name: "room", code: r.code });
    } catch (e) { setError(e.message); }
  }

  const Config = (
    <>
      <h2>Nombre de joueurs</h2>
      <div className="sizes">
        {[2, 3, 4].map((n) => (
          <button key={n} className={n === size ? "size on" : "size"} onClick={() => changeSize(n)}>
            <strong>{n}</strong><span>joueurs</span>
          </button>
        ))}
      </div>
      <h2>Mise par joueur</h2>
      <div className="chips">
        {PRESETS.map((p) => (
          <button key={p} className={p === stake ? "chip on" : "chip"} onClick={() => setStake(p)}>
            {p === 0 ? "Gratuit" : fmt(p)}
          </button>
        ))}
      </div>
      <label className="inline">Autre mise (Ar)
        <input type="number" min="0" step="100" value={stake}
          onChange={(e) => setStake(Math.max(0, parseInt(e.target.value || "0", 10)))} />
      </label>
      {stake > 0 && prev && (
        <div className="preview">
          <div><span>Cagnotte</span><b>{fmt(prev.pot)}</b></div>
          <div><span>Commission ({cfg.commission_percent} %)</span><b>− {fmt(prev.commission)}</b></div>
          <div className="win"><span>Gain du vainqueur</span><b>{fmt(prev.prize)}</b></div>
        </div>
      )}
      {stakeError && <p className="error">{stakeError}</p>}
    </>
  );

  return (
    <main className="page">
      <TopBar user={session.username} balance={me?.balance} isStaff={me?.is_staff}
        onAdmin={() => go({ name: "admin" })} onHome={() => {}} onLogout={onLogout} />

      {invite && (
        <div className="toast" role="alert">
          <span><b>{invite.from}</b> vous invite dans la room <b>{invite.code}</b></span>
          <div className="row gap">
            <button className="primary" onClick={() => go({ name: "room", code: invite.code })}>Rejoindre</button>
            <button className="ghost" onClick={() => setInvite(null)}>Ignorer</button>
          </div>
        </div>
      )}

      <div className="panel lobby">
        {me && <p className="muted">{me.wins} victoire{me.wins > 1 ? "s" : ""} · {me.played} partie{me.played > 1 ? "s" : ""} terminée{me.played > 1 ? "s" : ""}</p>}
        {me?.active_match && (
          <button className="ghost wide" onClick={() => go({ name: "game", id: me.active_match })}>Reprendre ma partie en cours</button>
        )}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "quick"} onClick={() => setTab("quick")}>Match rapide</button>
          <button role="tab" aria-selected={tab === "rooms"} onClick={() => setTab("rooms")}>Rooms privées</button>
        </div>

        {Config}

        {tab === "quick" ? (
          searching ? (
            <div className="searching" aria-live="polite">
              <div className="dots"><i /><i /><i /><i /></div>
              <p><b>{queue} / {size}</b> joueurs trouvés. Départ dès que la file est pleine.</p>
              <button className="ghost" onClick={() => send({ action: "cancel" })}>Annuler</button>
            </div>
          ) : (
            <button className="primary wide big" disabled={!!stakeError} onClick={start}>Lancer le matching</button>
          )
        ) : (
          <>
            <button className="primary wide big" disabled={!!stakeError} onClick={createRoom}>
              Créer une room{cfg?.room_fee ? ` · ${fmt(cfg.room_fee)}` : " · gratuit"}
            </button>
            {cfg?.room_fee > 0 && <p className="muted small">Frais de création non remboursables. Invitez ensuite vos amis avec le code ou leur pseudo.</p>}
            <h2>Rejoindre avec un code</h2>
            <div className="row gap">
              <input className="grow code" maxLength={6} placeholder="CODE" value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button className="ghost" disabled={code.length < 6} onClick={() => go({ name: "room", code })}>Rejoindre</button>
            </div>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <details className="history">
          <summary>Historique du solde</summary>
          {history.length === 0 ? <p className="muted small">Aucun mouvement.</p> : (
            <ul>{history.map((t) => (
              <li key={t.id}>
                <span>{KINDS[t.kind] || t.kind}</span>
                <b className={t.amount >= 0 ? "plus" : "minus"}>{t.amount >= 0 ? "+" : ""}{fmt(t.amount)}</b>
              </li>
            ))}</ul>
          )}
        </details>
      </div>
    </main>
  );
}
