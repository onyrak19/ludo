import secrets

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, Q, Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from . import services
from .models import GameSettings, Match, Room, Transaction, Wallet

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def cfg_dict(cfg):
    return {"room_fee": cfg.room_fee, "commission_percent": float(cfg.commission_percent),
            "min_stake": cfg.min_stake, "max_stake": cfg.max_stake, "signup_bonus": cfg.signup_bonus}


def tx_dict(t, with_user=False):
    d = {"id": t.id, "amount": t.amount, "kind": t.kind, "balance_after": t.balance_after,
         "note": t.note, "created_at": t.created_at.isoformat()}
    if with_user:
        d["user"] = t.user.username
    return d


# ------------------------------------------------------------ Joueur
@api_view(["GET"])
def public_settings(request):
    return Response(cfg_dict(GameSettings.get()))


@api_view(["GET"])
def my_transactions(request):
    return Response([tx_dict(t) for t in Transaction.objects.filter(user=request.user)[:20]])


@api_view(["POST"])
def create_room(request):
    cfg = GameSettings.get()
    size, stake = request.data.get("size"), request.data.get("stake", 0)
    if size not in (2, 3, 4) or not isinstance(stake, int) or stake < 0:
        return Response({"error": "Paramètres invalides."}, status=400)
    if stake and not (cfg.min_stake <= stake <= cfg.max_stake):
        return Response({"error": f"La mise doit être comprise entre {cfg.min_stake} et {cfg.max_stake} Ar."}, status=400)
    try:
        with transaction.atomic():
            if cfg.room_fee:
                services.move(request.user.id, -cfg.room_fee, "room_fee", "Création de room")
            if stake and services.locked(request.user.id).balance < stake:
                raise services.InsufficientFunds
            code = "".join(secrets.choice(ALPHABET) for _ in range(6))
            while Room.objects.filter(code=code).exists():
                code = "".join(secrets.choice(ALPHABET) for _ in range(6))
            room = Room.objects.create(code=code, owner=request.user, size=size, stake=stake, fee_paid=cfg.room_fee)
    except services.InsufficientFunds:
        return Response({"error": "Solde insuffisant (frais de room + mise)."}, status=400)
    return Response({"code": room.code})


# ------------------------------------------------------------ Admin (is_staff)
@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_stats(request):
    done = Match.objects.filter(status="finished")
    return Response({
        "players": User.objects.count(),
        "matches_running": Match.objects.filter(status="playing").count(),
        "matches_finished": done.count(),
        "commission_total": done.aggregate(s=Sum("commission"))["s"] or 0,
        "room_fees_total": Room.objects.aggregate(s=Sum("fee_paid"))["s"] or 0,
        "wallets_total": Wallet.objects.aggregate(s=Sum("balance"))["s"] or 0,
        "staked_running": Match.objects.filter(status="playing").aggregate(s=Sum("pot"))["s"] or 0,
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_players(request):
    q = request.GET.get("q", "").strip()
    users = User.objects.filter(username__icontains=q).annotate(
        played=Count("matches", filter=Q(matches__status="finished"), distinct=True),
        wins=Count("won_matches", distinct=True),
    ).order_by("-date_joined")[:100]
    balances = dict(Wallet.objects.filter(user__in=users).values_list("user_id", "balance"))
    return Response([{
        "id": u.id, "username": u.username, "balance": balances.get(u.id, 0), "is_active": u.is_active,
        "is_staff": u.is_staff, "played": u.played, "wins": u.wins, "joined": u.date_joined.date().isoformat(),
    } for u in users])


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_adjust(request, uid):
    try:
        amount = int(request.data.get("amount"))
    except (TypeError, ValueError):
        return Response({"error": "Montant invalide."}, status=400)
    if amount == 0 or not User.objects.filter(id=uid).exists():
        return Response({"error": "Montant ou joueur invalide."}, status=400)
    note = f"[{request.user.username}] {request.data.get('note') or 'Ajustement admin'}"
    try:
        with transaction.atomic():
            new_balance = services.move(uid, amount, "admin", note)
    except services.InsufficientFunds:
        return Response({"error": "Le solde ne peut pas devenir négatif."}, status=400)
    return Response({"balance": new_balance})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_toggle(request, uid):
    u = User.objects.filter(id=uid).first()
    if not u or u.id == request.user.id:
        return Response({"error": "Action impossible."}, status=400)
    u.is_active = not u.is_active
    u.save(update_fields=["is_active"])
    return Response({"is_active": u.is_active})


@api_view(["GET", "PUT"])
@permission_classes([IsAdminUser])
def admin_settings(request):
    cfg = GameSettings.get()
    if request.method == "PUT":
        try:
            room_fee, min_s = int(request.data["room_fee"]), int(request.data["min_stake"])
            max_s, bonus = int(request.data["max_stake"]), int(request.data["signup_bonus"])
            pct = float(request.data["commission_percent"])
        except (KeyError, TypeError, ValueError):
            return Response({"error": "Valeurs invalides."}, status=400)
        if min(room_fee, min_s, max_s, bonus) < 0 or not (0 <= pct <= 100) or max_s < min_s:
            return Response({"error": "Valeurs hors limites (commission 0-100 %, mise max ≥ mise min)."}, status=400)
        cfg.room_fee, cfg.min_stake, cfg.max_stake, cfg.signup_bonus = room_fee, min_s, max_s, bonus
        cfg.commission_percent = round(pct, 2)
        cfg.save()
    return Response(cfg_dict(cfg))


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_matches(request):
    out = []
    for m in Match.objects.select_related("winner").prefetch_related("players").order_by("-created_at")[:50]:
        out.append({"id": str(m.id), "status": m.status, "size": m.size, "stake": m.stake, "pot": m.pot,
                    "commission": m.commission, "prize": m.prize, "created_at": m.created_at.isoformat(),
                    "players": [p.username for p in m.players.all()],
                    "winner": m.winner.username if m.winner else None})
    return Response(out)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def admin_refund(request, mid):
    m = Match.objects.filter(pk=mid).first()
    if not m:
        return Response({"error": "Partie introuvable."}, status=404)
    try:
        m = services.refund_match(m)
    except ValueError as e:
        return Response({"error": str(e)}, status=400)
    async_to_sync(get_channel_layer().group_send)(f"game_{m.id}", {"type": "game.state", "state": m.state})
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_transactions(request):
    qs = Transaction.objects.select_related("user")
    if request.GET.get("user"):
        qs = qs.filter(user_id=request.GET["user"])
    return Response([tx_dict(t, True) for t in qs[:100]])
