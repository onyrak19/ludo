import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { fmt, preview } from "./format.js";

function useLoad(path, token) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { api(path, { token }).then(setData).catch(() => setData(null)); }, [path, tick, token]);
  return [data, () => setTick((t) => t + 1)];
}

export default function Admin({ session, onBack }) {
  const [tab, setTab] = useState("overview");
  const tabs = [["overview", "Vue d'ensemble"], ["players", "Joueurs"], ["matches", "Parties"], ["tx", "Transactions"]];
  return (
    <main className="page wide-page">
      <header className="topbar">
        <h1 className="logo small">ADMIN</h1>
        <button className="ghost" onClick={onBack}>← Retour au jeu</button>
      </header>
      <div className="tabs scroll" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "overview" && <Overview token={session.token} />}
      {tab === "players" && <Players token={session.token} />}
      {tab === "matches" && <Matches token={session.token} />}
      {tab === "tx" && <Txs token={session.token} />}
    </main>
  );
}

function Overview({ token }) {
  const [stats] = useLoad("admin/stats/", token);
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { api("admin/settings/", { token }).then(setCfg); }, [token]);

  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    setMsg("");
    try {
      const r = await api("admin/settings/", { method: "PUT", token, body: cfg });
      setCfg(r); setMsg("Paramètres enregistrés ✓");
    } catch (err) { setMsg(err.message); }
  }
  const ex = cfg ? preview(1000, 2, parseFloat(cfg.commission_percent) || 0) : null;

  return (
    <div className="grid-2">
      <section className="panel">
        <h2 className="first">Chiffres clés</h2>
        {stats && (
          <div className="stats">
            <div><span>Commissions gagnées</span><b>{fmt(stats.commission_total)}</b></div>
            <div><span>Frais de rooms</span><b>{fmt(stats.room_fees_total)}</b></div>
            <div><span>Soldes des joueurs</span><b>{fmt(stats.wallets_total)}</b></div>
            <div><span>Mises en jeu</span><b>{fmt(stats.staked_running)}</b></div>
            <div><span>Joueurs inscrits</span><b>{stats.players}</b></div>
            <div><span>Parties en cours</span><b>{stats.matches_running}</b></div>
            <div><span>Parties terminées</span><b>{stats.matches_finished}</b></div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="first">Tarifs & commission</h2>
        {cfg && (
          <form onSubmit={save}>
            <label>Tarif de création d'une room (Ar)<input type="number" min="0" value={cfg.room_fee} onChange={set("room_fee")} /></label>
            <label>Commission du jeu (%)<input type="number" min="0" max="100" step="0.01" value={cfg.commission_percent} onChange={set("commission_percent")} /></label>
            <div className="row gap">
              <label className="grow">Mise minimale (Ar)<input type="number" min="0" value={cfg.min_stake} onChange={set("min_stake")} /></label>
              <label className="grow">Mise maximale (Ar)<input type="number" min="0" value={cfg.max_stake} onChange={set("max_stake")} /></label>
            </div>
            <label>Bonus d'inscription (Ar)<input type="number" min="0" value={cfg.signup_bonus} onChange={set("signup_bonus")} /></label>
            <div className="preview">
              <div><span>Exemple : 2 joueurs, mise {fmt(1000)}</span><b>cagnotte {fmt(ex.pot)}</b></div>
              <div className="win"><span>Le vainqueur reçoit</span><b>{fmt(ex.prize)}</b></div>
            </div>
            <button className="primary">Enregistrer</button>
            {msg && <p className={msg.includes("✓") ? "ok" : "error"}>{msg}</p>}
          </form>
        )}
      </section>
    </div>
  );
}

function Players({ token }) {
  const [q, setQ] = useState("");
  const [players, reload] = useLoad(`admin/players/?q=${encodeURIComponent(q)}`, token);
  return (
    <section className="panel full">
      <input className="search" placeholder="Rechercher un joueur…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Joueur</th><th>Solde</th><th>Parties</th><th>Statut</th><th>Ajuster le solde</th></tr></thead>
          <tbody>{(players || []).map((p) => <PlayerRow key={p.id} p={p} token={token} reload={reload} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerRow({ p, token, reload }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  async function adjust(sign) {
    setErr("");
    const n = parseInt(amount, 10);
    if (!n || n <= 0) return setErr("Montant ?");
    try {
      await api(`admin/players/${p.id}/adjust/`, { method: "POST", token, body: { amount: sign * n, note } });
      setAmount(""); setNote(""); reload();
    } catch (e) { setErr(e.message); }
  }
  async function toggle() {
    try { await api(`admin/players/${p.id}/toggle/`, { method: "POST", token }); reload(); } catch (e) { setErr(e.message); }
  }
  return (
    <tr>
      <td>{p.username}{p.is_staff && <small className="badge">admin</small>}</td>
      <td><b>{fmt(p.balance)}</b></td>
      <td>{p.wins}/{p.played}</td>
      <td><span className={p.is_active ? "badge ok" : "badge ko"}>{p.is_active ? "actif" : "bloqué"}</span></td>
      <td>
        <div className="adjust">
          <input type="number" min="1" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input placeholder="Note (ex : dépôt MVola)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="primary" onClick={() => adjust(1)}>+ Créditer</button>
          <button className="ghost" onClick={() => adjust(-1)}>− Débiter</button>
          <button className="ghost" onClick={toggle}>{p.is_active ? "Bloquer" : "Débloquer"}</button>
        </div>
        {err && <small className="error">{err}</small>}
      </td>
    </tr>
  );
}

function Matches({ token }) {
  const [list, reload] = useLoad("admin/matches/", token);
  const [err, setErr] = useState("");
  async function refund(id) {
    if (!window.confirm("Annuler cette partie et rembourser les mises ?")) return;
    try { await api(`admin/matches/${id}/refund/`, { method: "POST", token }); reload(); } catch (e) { setErr(e.message); }
  }
  return (
    <section className="panel full">
      <div className="row between"><h2 className="first">50 dernières parties</h2><button className="ghost" onClick={reload}>Actualiser</button></div>
      {err && <p className="error">{err}</p>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>Date</th><th>Joueurs</th><th>Mise</th><th>Cagnotte</th><th>Commission</th><th>Statut</th><th>Vainqueur</th><th /></tr></thead>
          <tbody>{(list || []).map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.created_at).toLocaleString("fr-FR")}</td>
              <td>{m.players.join(", ")}</td>
              <td>{m.stake ? fmt(m.stake) : "—"}</td>
              <td>{m.stake ? fmt(m.pot) : "—"}</td>
              <td>{m.stake ? fmt(m.commission) : "—"}</td>
              <td><span className={`badge ${m.status === "finished" ? "ok" : m.status === "playing" ? "" : "ko"}`}>{m.status}</span></td>
              <td>{m.winner || "—"}</td>
              <td>{m.status === "playing" && <button className="ghost" onClick={() => refund(m.id)}>Annuler + rembourser</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Txs({ token }) {
  const [list, reload] = useLoad("admin/transactions/", token);
  return (
    <section className="panel full">
      <div className="row between"><h2 className="first">100 derniers mouvements</h2><button className="ghost" onClick={reload}>Actualiser</button></div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Date</th><th>Joueur</th><th>Type</th><th>Montant</th><th>Solde après</th><th>Note</th></tr></thead>
          <tbody>{(list || []).map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.created_at).toLocaleString("fr-FR")}</td><td>{t.user}</td><td>{t.kind}</td>
              <td className={t.amount >= 0 ? "plus" : "minus"}><b>{t.amount >= 0 ? "+" : ""}{fmt(t.amount)}</b></td>
              <td>{fmt(t.balance_after)}</td><td>{t.note}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
