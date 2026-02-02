import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class Session:
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: list[dict] = field(default_factory=list)
    tasks: list[dict] = field(default_factory=list)
    thumbnail: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Session":
        return cls(**data)


class SessionStore:
    def __init__(self, storage_path: str = "/tmp/manus-sessions"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _session_path(self, session_id: str) -> Path:
        return self.storage_path / f"{session_id}.json"

    def save(self, session: Session) -> None:
        session.updated_at = datetime.now().isoformat()
        with open(self._session_path(session.id), "w") as f:
            json.dump(session.to_dict(), f, indent=2)

    def load(self, session_id: str) -> Optional[Session]:
        path = self._session_path(session_id)
        if not path.exists():
            return None
        with open(path) as f:
            data = json.load(f)
            return Session.from_dict(data)

    def delete(self, session_id: str) -> bool:
        path = self._session_path(session_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def list_sessions(self, limit: int = 50) -> list[dict]:
        sessions = []
        for path in sorted(self.storage_path.glob("*.json"), key=os.path.getmtime, reverse=True):
            try:
                with open(path) as f:
                    data = json.load(f)
                    sessions.append({
                        "id": data["id"],
                        "title": data["title"],
                        "created_at": data["created_at"],
                        "updated_at": data["updated_at"],
                        "message_count": len(data.get("messages", [])),
                        "thumbnail": data.get("thumbnail"),
                    })
                    if len(sessions) >= limit:
                        break
            except (json.JSONDecodeError, KeyError):
                continue
        return sessions

    def create(self, session_id: str, title: str) -> Session:
        now = datetime.now().isoformat()
        session = Session(
            id=session_id,
            title=title,
            created_at=now,
            updated_at=now,
            messages=[],
            tasks=[],
        )
        self.save(session)
        return session

    def add_message(self, session_id: str, role: str, content: str) -> None:
        session = self.load(session_id)
        if session:
            session.messages.append({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat(),
            })
            self.save(session)

    def update_tasks(self, session_id: str, tasks: list[dict]) -> None:
        session = self.load(session_id)
        if session:
            session.tasks = tasks
            self.save(session)

    def set_thumbnail(self, session_id: str, thumbnail_b64: str) -> None:
        session = self.load(session_id)
        if session:
            session.thumbnail = thumbnail_b64
            self.save(session)
