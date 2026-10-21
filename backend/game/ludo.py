"""Règles du Ludo, côté serveur (source de vérité).

Progression d'un pion : -1 = base, 0..50 = parcours principal (relatif à la case de
départ de sa couleur), 51..55 = couloir final, 56 = centre (arrivé).
"""
import random

TRACK = 52
FINISH = 56
COLORS = ["red", "green", "yellow", "blue"]
START = [0, 13, 26, 39]                      # case de départ (absolue) de chaque couleur
SAFE = {0, 8, 13, 21, 26, 34, 39, 47}        # départs + cases étoilées
SEATS = {2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3]}   # couleurs utilisées selon le nombre de joueurs


def new_state(users):
    """users : liste de (user_id, username). Ordre et couleurs tirés au hasard."""
    order = random.sample(users, len(users))
    seats = random.sample(SEATS[len(users)], len(users))
    players = [{"id": uid, "name": name, "color": COLORS[s], "out": False}
               for (uid, name), s in zip(order, seats)]
    players.sort(key=lambda p: COLORS.index(p["color"]))
    random.shuffle(players)
    return {
        "players": players,
        "pawns": [[-1] * 4 for _ in players],
        "turn": 0, "dice": None, "movable": [], "sixes": 0,
        "last": None, "status": "playing", "winner": None,
        "log": ["La partie commence !"],
    }


def abs_pos(state, i, p):
    if 0 <= p <= 50:
        return (START[COLORS.index(state["players"][i]["color"])] + p) % TRACK
    return None


def movable(state, i, dice):
    out = []
    for k, p in enumerate(state["pawns"][i]):
        if p == -1:
            if dice == 6:
                out.append(k)
        elif p + dice <= FINISH:
            out.append(k)
    return out


def _log(state, msg):
    state["log"] = (state["log"] + [msg])[-8:]


def _next_turn(state):
    n = len(state["players"])
    for _ in range(n):
        state["turn"] = (state["turn"] + 1) % n
        if not state["players"][state["turn"]]["out"]:
            break
    state["dice"], state["movable"], state["sixes"] = None, [], 0


def _roll(state, i):
    if state["dice"] is not None:
        return "Dé déjà lancé."
    name = state["players"][i]["name"]
    d = random.randint(1, 6)
    state["last"] = {"seat": i, "value": d, "n": (state["last"] or {}).get("n", 0) + 1}
    state["sixes"] = state["sixes"] + 1 if d == 6 else 0
    if state["sixes"] == 3:
        _log(state, f"{name} fait trois 6 d'affilée et passe son tour.")
        _next_turn(state)
        return None
    mv = movable(state, i, d)
    if not mv:
        _log(state, f"{name} fait {d} : aucun déplacement possible.")
        _next_turn(state)
    else:
        state["dice"], state["movable"] = d, mv
    return None


def _move(state, i, pawn):
    d = state["dice"]
    if d is None or pawn not in state["movable"]:
        return "Déplacement impossible."
    pl = state["players"][i]
    p = state["pawns"][i][pawn]
    new = 0 if p == -1 else p + d
    state["pawns"][i][pawn] = new
    captured = False
    a = abs_pos(state, i, new)
    if a is not None and a not in SAFE:
        for j in range(len(state["players"])):
            if j == i:
                continue
            for k, q in enumerate(state["pawns"][j]):
                if abs_pos(state, j, q) == a:
                    state["pawns"][j][k] = -1
                    captured = True
                    _log(state, f"{pl['name']} capture un pion de {state['players'][j]['name']} !")
    arrived = new == FINISH
    if arrived:
        _log(state, f"{pl['name']} amène un pion au centre.")
    state["dice"], state["movable"] = None, []
    if all(x == FINISH for x in state["pawns"][i]):
        state["status"], state["winner"] = "finished", pl["id"]
        _log(state, f"{pl['name']} gagne la partie !")
    elif d == 6 or captured or arrived:
        pass  # tour supplémentaire
    else:
        _next_turn(state)
    return None


def _forfeit(state, uid):
    idx = next((k for k, p in enumerate(state["players"]) if p["id"] == uid), None)
    if idx is None or state["players"][idx]["out"]:
        return "Action impossible."
    state["players"][idx]["out"] = True
    _log(state, f"{state['players'][idx]['name']} abandonne.")
    active = [p for p in state["players"] if not p["out"]]
    if len(active) == 1:
        state["status"], state["winner"] = "finished", active[0]["id"]
        _log(state, f"{active[0]['name']} gagne par abandon.")
    elif state["turn"] == idx:
        _next_turn(state)
    return None


def apply(state, uid, msg):
    """Applique une action. Retourne un message d'erreur, ou None si OK."""
    if state["status"] != "playing":
        return "Partie terminée."
    action = msg.get("action")
    if action == "forfeit":
        return _forfeit(state, uid)
    i = state["turn"]
    if state["players"][i]["id"] != uid:
        return "Ce n'est pas votre tour."
    if action == "roll":
        return _roll(state, i)
    if action == "move":
        return _move(state, i, msg.get("pawn"))
    return "Action inconnue."
