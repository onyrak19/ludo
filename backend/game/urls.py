from django.urls import path
from . import api

urlpatterns = [
    path("settings/", api.public_settings),
    path("transactions/", api.my_transactions),
    path("rooms/", api.create_room),
    path("admin/stats/", api.admin_stats),
    path("admin/players/", api.admin_players),
    path("admin/players/<int:uid>/adjust/", api.admin_adjust),
    path("admin/players/<int:uid>/toggle/", api.admin_toggle),
    path("admin/settings/", api.admin_settings),
    path("admin/matches/", api.admin_matches),
    path("admin/matches/<uuid:mid>/refund/", api.admin_refund),
    path("admin/transactions/", api.admin_transactions),
]
