import React, { useState } from "react";
import Auth from "./Auth.jsx";
import Lobby from "./Lobby.jsx";
import Room from "./Room.jsx";
import Game from "./Game.jsx";
import Admin from "./Admin.jsx";

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ludo-session")); } catch { return null; }
  });
  // Un lien d'invitation (?room=CODE) ouvre directement la room après connexion
  const [screen, setScreen] = useState(() => {
    const code = new URLSearchParams(location.search).get("room");
    return code ? { name: "room", code: code.toUpperCase() } : { name: "lobby" };
  });

  const go = (s) => {
    if (location.search) history.replaceState(null, "", location.pathname);
    setScreen(s);
  };
  const login = (s) => { localStorage.setItem("ludo-session", JSON.stringify(s)); setSession(s); };
  const logout = () => { localStorage.removeItem("ludo-session"); setSession(null); setScreen({ name: "lobby" }); };

  if (!session) return <Auth onLogin={login} />;
  const lobby = () => go({ name: "lobby" });
  if (screen.name === "game") return <Game session={session} matchId={screen.id} onLeave={lobby} />;
  if (screen.name === "room") return <Room session={session} code={screen.code} go={go} />;
  if (screen.name === "admin") return <Admin session={session} onBack={lobby} />;
  return <Lobby session={session} go={go} onLogout={logout} />;
}
