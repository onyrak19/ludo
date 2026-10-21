import asyncio
import random
from collections import defaultdict
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.authtoken.models import Token

from . import ludo, services
from .models import GameSettings, Match, Room

# Files d'attente en mémoire : (taille, mise) -> joueurs. Un seul processus (voir README).
QUEUES = defaultdict(list)
LOCK = asyncio.Lock()


def token_from_scope(scope):
    return parse_qs(scope["query_string"].decode()).get("token", [""])[0]


@database_sync_to_async
def user_from_token(key):
    try:
        user = Token.objects.select_related("user").get(key=key).user
    except Token.DoesNotExist:
        return None
    return user if user.is_active else None


@database_sync_to_async
def check_join(uid, size, stake):
    cfg = GameSettings.get()
    if size not in (2, 3, 4):
        return "Nombre de joueurs invalide."
    if not isinstance(stake, int) or stake < 0:
        return "Mise invalide."
    if stake and not (cfg.min_stake <= stake <= cfg.max_stake):
        return f"La mise doit être comprise entre {cfg.min_stake} et {cfg.max_stake} Ar."
    if stake and services.balance(uid) < stake:
        return "Solde insuffisant pour cette mise."
    return None


@database_sync_to_async
def create_match_db(entries, stake):
    m, failed = services.create_match([(e["uid"], e["name"]) for e in entries], stake)
    return (str(m.id) if m else None), failed


# ---------------------------------------------------------------- Salon / matchmaking
class MatchmakingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = await user_from_token(token_from_scope(self.scope))
        if not self.user:
            await self.close(code=4401)
            return
        await self.channel_layer.group_add(f"user_{self.user.id}", self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if getattr(self, "user", None):
            await self.channel_layer.group_discard(f"user_{self.user.id}", self.channel_name)
            async with LOCK:
                self._remove()
                await self._broadcast_counts()

    def _remove(self):
        for q in list(QUEUES.values()):
            q[:] = [e for e in q if e["uid"] != self.user.id and e["channel"] != self.channel_name]

    async def _broadcast_counts(self):
        for (size, stake), q in list(QUEUES.items()):
            for e in q:
                await self.channel_layer.send(e["channel"], {"type": "queue.update", "count": len(q), "size": size})

    async def receive_json(self, content):
        action = content.get("action")
        async with LOCK:
            self._remove()
            if action == "join":
                size, stake = content.get("size"), content.get("stake", 0)
                err = await check_join(self.user.id, size, stake)
                if err:
                    await self.send_json({"type": "error", "message": err})
                    await self._broadcast_counts()
                    return
                q = QUEUES[(size, stake)]
                q.append({"uid": self.user.id, "name": self.user.username, "channel": self.channel_name})
                while len(q) >= size:
                    group = random.sample(q, size)          # joueurs tirés au hasard
                    q[:] = [e for e in q if e not in group]
                    match_id, failed = await create_match_db(group, stake)
                    for e in group:
                        if match_id:
                            await self.channel_layer.send(e["channel"], {"type": "match.found", "match_id": match_id})
                        elif e["uid"] in failed:
                            await self.channel_layer.send(e["channel"], {"type": "refused"})
                        else:
                            q.append(e)
            await self._broadcast_counts()
            if action == "cancel":
                await self.send_json({"type": "cancelled"})

    async def match_found(self, event):
        await self.send_json({"type": "match_found", "match_id": event["match_id"]})

    async def queue_update(self, event):
        await self.send_json({"type": "queue", "count": event["count"], "size": event["size"]})

    async def refused(self, event):
        await self.send_json({"type": "error", "message": "Solde insuffisant : recherche annulée."})
        await self.send_json({"type": "cancelled"})

    async def user_invite(self, event):
        await self.send_json({"type": "invite", **event["invite"]})


# ---------------------------------------------------------------- Partie
@database_sync_to_async
def get_state_if_player(match_id, uid):
    try:
        m = Match.objects.get(id=match_id)
    except Match.DoesNotExist:
        return None
    return m.state if m.players.filter(id=uid).exists() else None


@database_sync_to_async
def apply_action(match_id, uid, content):
    with transaction.atomic():
        m = Match.objects.select_for_update().get(id=match_id)
        if m.status != "playing" or ludo.apply(m.state, uid, content) is not None:
            return None
        if m.state["status"] == "finished":
            m.status, m.winner_id = "finished", m.state["winner"]
            services.settle(m)
        m.save()
        return m.state


class GameConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.match_id = str(self.scope["url_route"]["kwargs"]["match_id"])
        self.user = await user_from_token(token_from_scope(self.scope))
        state = await get_state_if_player(self.match_id, self.user.id) if self.user else None
        if state is None:
            await self.close(code=4403)
            return
        self.group = f"game_{self.match_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self.send_json({"type": "state", "state": state, "me": self.user.id})

    async def disconnect(self, code):
        if getattr(self, "group", None):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        state = await apply_action(self.match_id, self.user.id, content)
        if state is not None:
            await self.channel_layer.group_send(self.group, {"type": "game.state", "state": state})

    async def game_state(self, event):
        await self.send_json({"type": "state", "state": event["state"], "me": self.user.id})


# ---------------------------------------------------------------- Rooms privées
def room_snapshot(r):
    cfg = GameSettings.get()
    return {
        "code": r.code, "owner_id": r.owner_id, "owner": r.owner.username, "size": r.size,
        "stake": r.stake, "status": r.status,
        "members": [{"id": u.id, "name": u.username} for u in r.members.order_by("id")],
        "bet": services.bet_preview(r.stake, r.size, cfg.commission_percent),
    }


@database_sync_to_async
def join_room(code, uid):
    with transaction.atomic():
        try:
            r = Room.objects.select_for_update().get(code=code)
        except Room.DoesNotExist:
            return None, "Room introuvable."
        if r.status != "waiting":
            return None, "Cette room n'est plus disponible."
        if not r.members.filter(id=uid).exists():
            if r.members.count() >= r.size:
                return None, "Cette room est pleine."
            if r.stake and services.balance(uid) < r.stake:
                return None, "Solde insuffisant pour la mise de cette room."
            r.members.add(uid)
        return room_snapshot(r), None


@database_sync_to_async
def try_start(code):
    with transaction.atomic():
        r = Room.objects.select_for_update().get(code=code)
        if r.status != "waiting" or r.members.count() < r.size:
            return None
        users = [(u.id, u.username) for u in r.members.all()]
        m, failed = services.create_match(users, r.stake)
        if failed:
            r.members.remove(*failed)
            if r.owner_id in failed:
                r.status = "closed"
                r.save()
            return {"kicked": failed, "closed": r.status == "closed", "room": room_snapshot(r)}
        r.status, r.match = "started", m
        r.save()
        return {"match_id": str(m.id)}


@database_sync_to_async
def leave_room(code, uid):
    with transaction.atomic():
        try:
            r = Room.objects.select_for_update().get(code=code)
        except Room.DoesNotExist:
            return None
        if r.status != "waiting":
            return None
        if uid == r.owner_id:
            r.status = "closed"
            r.save()
            return {"closed": True}
        r.members.remove(uid)
        return {"room": room_snapshot(r)}


@database_sync_to_async
def find_user(username):
    return User.objects.filter(username__iexact=username, is_active=True).values("id", "username").first()


class RoomConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.joined = False
        self.code = self.scope["url_route"]["kwargs"]["code"].upper()
        self.user = await user_from_token(token_from_scope(self.scope))
        if not self.user:
            await self.close(code=4401)
            return
        room, err = await join_room(self.code, self.user.id)
        await self.accept()
        if err:
            await self.send_json({"type": "error", "message": err})
            await self.close()
            return
        self.joined, self.group, self.owner_id = True, f"room_{self.code}", room["owner_id"]
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.channel_layer.group_send(self.group, {"type": "room.state", "room": room})
        await self._try_start()

    async def _try_start(self):
        res = await try_start(self.code)
        if not res:
            return
        if "match_id" in res:
            await self.channel_layer.group_send(self.group, {"type": "room.start", "match_id": res["match_id"]})
        else:
            await self.channel_layer.group_send(self.group, {"type": "room.kicked", **res})

    async def disconnect(self, code):
        if not self.joined:
            return
        await self.channel_layer.group_discard(self.group, self.channel_name)
        res = await leave_room(self.code, self.user.id)
        if res and res.get("closed"):
            await self.channel_layer.group_send(self.group, {"type": "room.closed"})
        elif res:
            await self.channel_layer.group_send(self.group, {"type": "room.state", "room": res["room"]})

    async def receive_json(self, content):
        if content.get("action") == "invite" and self.user.id == self.owner_id:
            target = await find_user(str(content.get("username", "")).strip())
            if not target:
                await self.send_json({"type": "error", "message": "Joueur introuvable."})
                return
            await self.channel_layer.group_send(f"user_{target['id']}", {"type": "user.invite", "invite": {
                "code": self.code, "from": self.user.username}})
            await self.send_json({"type": "invite_sent", "username": target["username"]})

    async def room_state(self, event):
        await self.send_json({"type": "room", "room": event["room"]})

    async def room_start(self, event):
        await self.send_json({"type": "match_found", "match_id": event["match_id"]})

    async def room_closed(self, event):
        await self.send_json({"type": "closed"})

    async def room_kicked(self, event):
        if self.user.id in event["kicked"]:
            await self.send_json({"type": "error", "message": "Solde insuffisant : vous avez été retiré de la room."})
            await self.close()
        elif event.get("closed"):
            await self.send_json({"type": "closed"})
        else:
            await self.send_json({"type": "room", "room": event["room"]})
