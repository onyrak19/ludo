from django.contrib import admin
from .models import GameSettings, Match, Room, Transaction, Wallet


@admin.register(GameSettings)
class GameSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not GameSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("user", "balance")
    search_fields = ("user__username",)
    readonly_fields = ("user", "balance")   # modifier les soldes via le panneau admin (journal tenu à jour)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "kind", "amount", "balance_after", "note")
    list_filter = ("kind",)
    search_fields = ("user__username",)


admin.site.register(Match)
admin.site.register(Room)
