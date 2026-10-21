from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path("ws/matchmaking/", consumers.MatchmakingConsumer.as_asgi()),
    path("ws/game/<uuid:match_id>/", consumers.GameConsumer.as_asgi()),
    path("ws/room/<str:code>/", consumers.RoomConsumer.as_asgi()),
]
