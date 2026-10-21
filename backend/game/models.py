import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

U = settings.AUTH_USER_MODEL


class GameSettings(models.Model):
    """Paramètres modifiables par l'admin (une seule ligne)."""
    room_fee = models.PositiveIntegerField("Tarif de création d'une room (Ar)", default=500)
    commission_percent = models.DecimalField("Commission du jeu (%)", max_digits=5, decimal_places=2, default=Decimal("10"),
                                             validators=[MinValueValidator(0), MaxValueValidator(100)])
    min_stake = models.PositiveIntegerField("Mise minimale (Ar)", default=500)
    max_stake = models.PositiveIntegerField("Mise maximale (Ar)", default=100000)
    signup_bonus = models.PositiveIntegerField("Bonus d'inscription (Ar)", default=0)

    class Meta:
        verbose_name = verbose_name_plural = "Paramètres du jeu"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "Paramètres du jeu"


class Wallet(models.Model):
    user = models.OneToOneField(U, on_delete=models.CASCADE, related_name="wallet")
    balance = models.BigIntegerField(default=0)

    def __str__(self):
        return f"{self.user} : {self.balance} Ar"


class Transaction(models.Model):
    """Journal de tous les mouvements d'argent."""
    user = models.ForeignKey(U, on_delete=models.CASCADE, related_name="transactions")
    amount = models.BigIntegerField()                 # signé : + crédit, - débit
    kind = models.CharField(max_length=20)            # admin, bonus, room_fee, stake, payout, refund
    balance_after = models.BigIntegerField()
    note = models.CharField(max_length=200, blank=True)
    match = models.ForeignKey("Match", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class Match(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    size = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, default="playing")  # playing | finished | cancelled
    state = models.JSONField(default=dict)
    players = models.ManyToManyField(U, related_name="matches")
    winner = models.ForeignKey(U, null=True, blank=True, on_delete=models.SET_NULL, related_name="won_matches")
    stake = models.PositiveIntegerField(default=0)       # mise par joueur
    pot = models.PositiveIntegerField(default=0)         # cagnotte totale
    commission = models.PositiveIntegerField(default=0)  # part du jeu
    prize = models.PositiveIntegerField(default=0)       # gain du vainqueur
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Match {self.id} ({self.size} joueurs, {self.status})"


class Room(models.Model):
    code = models.CharField(max_length=6, unique=True)
    owner = models.ForeignKey(U, on_delete=models.CASCADE, related_name="owned_rooms")
    size = models.PositiveSmallIntegerField()
    stake = models.PositiveIntegerField(default=0)
    fee_paid = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, default="waiting")  # waiting | started | closed
    members = models.ManyToManyField(U, related_name="rooms", blank=True)
    match = models.ForeignKey(Match, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Room {self.code} ({self.status})"
