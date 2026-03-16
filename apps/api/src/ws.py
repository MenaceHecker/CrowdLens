import json
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self.feed_connections: Set[WebSocket] = set()
        self.event_connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect_feed(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.feed_connections.add(websocket)

    def disconnect_feed(self, websocket: WebSocket) -> None:
        self.feed_connections.discard(websocket)

    async def connect_event(self, event_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.event_connections[event_id].add(websocket)

    def disconnect_event(self, event_id: str, websocket: WebSocket) -> None:
        if event_id in self.event_connections:
            self.event_connections[event_id].discard(websocket)
            if not self.event_connections[event_id]:
                del self.event_connections[event_id]
