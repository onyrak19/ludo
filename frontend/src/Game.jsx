import React, { useEffect, useRef, useState } from "react";
import { openSocket } from "./api.js";
import Board from "./Board.jsx";
import Die from "./Die.jsx";
import { HEX } from "./board.js";
import { fmt } from "./format.js";
import { useAnimatedPawns } from "./useAnimatedPawns.js";

export default function Game({ session, matchId, onLeave }) {
  const [state, setState] = useState(null);
  const [me, setMe] = useState(null);
  const [closed, setClosed] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    const sock = openSocket(`game/${matchId}/`, session.token);
    ws.current = sock;
    sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state") { setState(msg.state); setMe(msg.me); }
    };
    sock.onclose = () => setClosed(true);
    return () => sock.close();
  }, [matchId, session.token]);

  const send = (data) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(data));

  if (!state) {
    return (
      <main className="center">
        <div className="panel">
          <p>{closed ? "Impossible de rejoindre cette partie." : "Connexion à la partie…"}</p>
          {closed && <button className="primary" onClick={onLeave}>Retour au salon</button>}
        </div>
      </main>
    );
  }
  return <Table state={state} me={me} send={send} onLeave={onLeave} />;
}

function Table({ state, me, send, onLeave }) {
  const { shown, busy } = useAnimatedPawns(state.pawns);
  const myIndex = state.players.findIndex((p) => p.id === me);
  const current = state.players[state.turn];
  const myTurn = state.status === "playing" && myIndex === state.turn;
  const finished = state.status !== "playing";
  const cancelled = state.status === "cancelled";
  const bet = state.bet;
  const winner = state.players.find((p) => p.id === state.winner);
  const canRoll = myTurn && state.dice === null && !busy;

  let hint;
  if (cancelled) hint = "Partie annulée : mises remboursées";
  else if (finished && !busy) hint = winner?.id === me ? "Victoire !" : `${winner?.name} remporte la partie`;
  else if (myTurn && state.dice === null) hint = "À vous : touchez le dé";
  else if (myTurn && state.dice !== null) hint = "Choisissez un pion";
  else hint = `Tour de ${current.name}`;

  const dieColor = HEX[(finished ? winner : current)?.color || "blue"];

  return (
    <main className="game">
      <section className="stage">
        <div className="board-wrap">
          <Board state={state} shown={shown} myIndex={myIndex} busy={busy}
            onPawn={(k) => send({ action: "move", pawn: k })} />
          <Die last={state.last} color={dieColor} canRoll={canRoll} onRoll={() => send({ action: "roll" })} />
        </div>
        <p className="status" style={{ "--c": dieColor }} aria-live="polite">{hint}</p>
      </section>

      <aside className="panel side">
        <h2>Joueurs</h2>
        <ul className="players">
          {state.players.map((p, i) => {
            const done = state.pawns[i].filter((x) => x === 56).length;
            return (
              <li key={p.id} className={i === state.turn && !finished ? "active" : ""} style={{ "--c": HEX[p.color] }}>
                <i className="dot" />
                <span>{p.name}{p.id === me ? " (vous)" : ""}</span>
                {p.out ? <small>abandon</small> : done > 0 && <small>{done}/4</small>}
              </li>
            );
          })}
        </ul>

        {bet && bet.stake > 0 && (
          <div className="preview">
            <div><span>Mise</span><b>{fmt(bet.stake)}</b></div>
            <div><span>Cagnotte</span><b>{fmt(bet.pot)}</b></div>
            <div className="win"><span>Gain du vainqueur</span><b>{fmt(bet.prize)}</b></div>
            {finished && !busy && !cancelled && (
              <div className={winner?.id === me ? "plus result" : "minus result"}>
                {winner?.id === me ? `+ ${fmt(bet.prize)} crédités` : `− ${fmt(bet.stake)}`}
              </div>
            )}
          </div>
        )}

        <h2>Journal</h2>
        <ol className="log">{state.log.map((l, i) => <li key={i}>{l}</li>)}</ol>

        {finished ? (
          <button className="primary wide" onClick={onLeave}>Retour au salon</button>
        ) : (
          <button className="ghost wide" onClick={() => {
            if (window.confirm("Abandonner la partie ?")) { send({ action: "forfeit" }); onLeave(); }
          }}>Abandonner</button>
        )}
      </aside>
    </main>
  );
}
