import React, { useState } from "react";
import { api } from "./api.js";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api(mode === "login" ? "login/" : "register/", {
        method: "POST",
        body: { username, password },
      });
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center">
      <div className="panel auth">
        <h1 className="logo">Ludo</h1>
        <p className="muted">Affrontez 1 à 3 joueurs en ligne, partie après partie.</p>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Connexion</button>
          <button role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Créer un compte</button>
        </div>
        <form onSubmit={submit}>
          <label>Pseudo
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>
            {mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
      </div>
    </main>
  );
}
