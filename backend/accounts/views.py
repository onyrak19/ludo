from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from django.db import transaction

from game import services
from game.models import GameSettings, Match


def auth_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, "username": user.username}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    if not (3 <= len(username) <= 20):
        return Response({"error": "Le pseudo doit contenir entre 3 et 20 caractères."}, status=400)
    if len(password) < 6:
        return Response({"error": "Le mot de passe doit contenir au moins 6 caractères."}, status=400)
    if User.objects.filter(username__iexact=username).exists():
        return Response({"error": "Ce pseudo est déjà pris."}, status=400)
    with transaction.atomic():
        user = User.objects.create_user(username=username, password=password)
        bonus = GameSettings.get().signup_bonus
        if bonus:
            services.move(user.id, bonus, "bonus", "Bonus d'inscription")
    return Response(auth_payload(user), status=201)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
    if not user:
        return Response({"error": "Pseudo ou mot de passe incorrect."}, status=400)
    return Response(auth_payload(user))


@api_view(["GET"])
def me(request):
    played = Match.objects.filter(players=request.user, status="finished").count()
    wins = Match.objects.filter(winner=request.user).count()
    active = Match.objects.filter(players=request.user, status="playing").order_by("-created_at").first()
    return Response({
        "username": request.user.username,
        "balance": services.balance(request.user.id),
        "is_staff": request.user.is_staff,
        "played": played,
        "wins": wins,
        "active_match": str(active.id) if active else None,
    })
