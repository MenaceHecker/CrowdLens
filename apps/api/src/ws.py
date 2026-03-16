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

    async def broadcast_feed_updated(self) -> None:
        if not self.feed_connections:
            return

        message = json.dumps({"type": "feed_updated"})
        dead_connections: list[WebSocket] = []

        for websocket in self.feed_connections:
            try:
                await websocket.send_text(message)
            except Exception:
                dead_connections.append(websocket)

        for websocket in dead_connections:
            self.disconnect_feed(websocket)

    async def broadcast_event_updated(self, event_id: str) -> None:
        if event_id not in self.event_connections:
            return

        message = json.dumps(
            {
                "type": "event_updated",
                "event_id": event_id,
            }
        )

        dead_connections: list[WebSocket] = []

        for websocket in self.event_connections[event_id]:
            try:
                await websocket.send_text(message)
            except Exception:
                dead_connections.append(websocket)

        for websocket in dead_connections:
            self.disconnect_event(event_id, websocket)