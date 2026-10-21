import React from "react";
import { fmt } from "./format.js";

export default function TopBar({ user, balance, isStaff, onAdmin, onHome, onLogout }) {
  return (
    <header className="topbar">
      <button className="logo small linklike" onClick={onHome} aria-label="Accueil">LUDO</button>
      <div className="row gap wrap">
        {balance !== null && balance !== undefined && (
          <span className="balance" title="Votre solde"><i>◈</i> {fmt(balance)}</span>
        )}
        <span className="muted">{user}</span>
        {isStaff && <button className="ghost" onClick={onAdmin}>Admin</button>}
        {onLogout && <button className="ghost" onClick={onLogout}>Quitter</button>}
      </div>
    </header>
  );
}
