"""Logique d'argent : toutes les opérations passent par move() (verrou + journal)."""
from decimal import Decimal, ROUND_FLOOR

from django.db import transaction

from . import ludo
from .models import GameSettings, Match, Transaction as Tx, Wallet


class InsufficientFunds(Exception):
    pass


def locked(uid):
    Wallet.objects.get_or_create(user_id=uid)
    return Wallet.objects.select_for_update().get(user_id=uid)


def balance(uid):
    return Wallet.objects.filter(user_id=uid).values_list("balance", flat=True).first() or 0


def move(uid, amount, kind, note="", match=None):
    """Crédite (+) ou débite (-) un joueur. À appeler dans transaction.atomic()."""
    w = locked(uid)
    if w.balance + amount < 0:
        raise InsufficientFunds(uid)
    w.balance += amount
    w.save(update_fields=["balance"])
    Tx.objects.create(user_id=uid, amount=amount, kind=kind, balance_after=w.balance, note=note[:200], match=match)
    return w.balance


def bet_preview(stake, n, percent):
    pot = stake * n
    commission = int((Decimal(pot) * Decimal(str(percent)) / 100).to_integral_value(ROUND_FLOOR))
    return {"stake": stake, "pot": pot, "commission": commission, "prize": pot - commission, "percent": float(percent)}


def create_match(users, stake):
    """users = [(uid, nom)]. Débite les mises et crée la partie. Retourne (match, ids_sans_fonds)."""
    cfg = GameSettings.get()
    with transaction.atomic():
        uids = sorted(u[0] for u in users)          # ordre fixe : évite les blocages entre transactions
        if stake:
            failed = [uid for uid in uids if locked(uid).balance < stake]
            if failed:
                return None, failed
        bet = bet_preview(stake, len(users), cfg.commission_percent)
        state = ludo.new_state(users)
        state["bet"] = bet
        m = Match.objects.create(size=len(users), state=state, stake=stake, pot=bet["pot"],
                                 commission=bet["commission"], prize=bet["prize"],
                                 commission_percent=cfg.commission_percent)
        m.players.set(uids)
        if stake:
            for uid in uids:
                move(uid, -stake, "stake", "Mise de la partie", match=m)
        return m, []


def settle(m):
    """Verse le gain au vainqueur (une seule fois). À appeler dans transaction.atomic()."""
    bet = m.state.get("bet") or {}
    if m.stake and m.winner_id and not bet.get("settled"):
        move(m.winner_id, m.prize, "payout", "Gain de la partie", match=m)
        bet["settled"] = True
        m.state["bet"] = bet


def refund_match(m):
    """Annule une partie en cours et rembourse les mises."""
    with transaction.atomic():
        m = Match.objects.select_for_update().get(pk=m.pk)
        if m.status != "playing":
            raise ValueError("Partie déjà terminée.")
        if m.stake:
            for uid in m.players.values_list("id", flat=True):
                move(uid, m.stake, "refund", "Partie annulée par l'admin", match=m)
        m.status = "cancelled"
        m.state["status"] = "cancelled"
        m.state["log"] = (m.state.get("log", []) + ["Partie annulée par l'administrateur."])[-8:]
        m.save()
    return m
