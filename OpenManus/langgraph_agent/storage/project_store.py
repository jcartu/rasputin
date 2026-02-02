import json
import os
import shutil
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class Project:
    id: str
    name: str
    description: str = ""
    instructions: str = ""
    pinned: bool = False
    created_at: str = ""
    updated_at: str = ""
    files: list[dict] = field(default_factory=list)
    connectors: list[dict] = field(default_factory=list)
    session_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Project":
        return cls(**data)


class ProjectStore:
    def __init__(self, storage_path: str = "/tmp/manus-projects"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _project_path(self, project_id: str) -> Path:
        return self.storage_path / f"{project_id}.json"

    def _project_files_path(self, project_id: str) -> Path:
        path = self.storage_path / f"{project_id}_files"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def save(self, project: Project) -> None:
        project.updated_at = datetime.now().isoformat()
        with open(self._project_path(project.id), "w") as f:
            json.dump(project.to_dict(), f, indent=2)

    def load(self, project_id: str) -> Optional[Project]:
        path = self._project_path(project_id)
        if not path.exists():
            return None
        with open(path) as f:
            data = json.load(f)
            return Project.from_dict(data)

    def delete(self, project_id: str) -> bool:
        path = self._project_path(project_id)
        files_path = self._project_files_path(project_id)
        deleted = False
        if path.exists():
            path.unlink()
            deleted = True
        if files_path.exists():
            shutil.rmtree(files_path)
        return deleted

    def list_projects(self, limit: int = 100) -> list[dict]:
        projects = []
        for path in sorted(
            self.storage_path.glob("*.json"), key=os.path.getmtime, reverse=True
        ):
            try:
                with open(path) as f:
                    data = json.load(f)
                    projects.append({
                        "id": data["id"],
                        "name": data["name"],
                        "description": data.get("description", ""),
                        "pinned": data.get("pinned", False),
                        "created_at": data["created_at"],
                        "updated_at": data["updated_at"],
                        "file_count": len(data.get("files", [])),
                        "session_count": len(data.get("session_ids", [])),
                    })
                    if len(projects) >= limit:
                        break
            except (json.JSONDecodeError, KeyError):
                continue

        projects.sort(key=lambda p: (not p["pinned"], p["updated_at"]), reverse=True)
        return projects

    def create(self, project_id: str, name: str, description: str = "") -> Project:
        now = datetime.now().isoformat()
        project = Project(
            id=project_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
        )
        self.save(project)
        return project

    def update(
        self,
        project_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        instructions: Optional[str] = None,
        pinned: Optional[bool] = None,
    ) -> Optional[Project]:
        project = self.load(project_id)
        if not project:
            return None
        if name is not None:
            project.name = name
        if description is not None:
            project.description = description
        if instructions is not None:
            project.instructions = instructions
        if pinned is not None:
            project.pinned = pinned
        self.save(project)
        return project

    def add_session(self, project_id: str, session_id: str) -> bool:
        project = self.load(project_id)
        if not project:
            return False
        if session_id not in project.session_ids:
            project.session_ids.append(session_id)
            self.save(project)
        return True

    def remove_session(self, project_id: str, session_id: str) -> bool:
        project = self.load(project_id)
        if not project:
            return False
        if session_id in project.session_ids:
            project.session_ids.remove(session_id)
            self.save(project)
        return True

    def add_file(self, project_id: str, filename: str, content: bytes) -> Optional[dict]:
        project = self.load(project_id)
        if not project:
            return None

        files_path = self._project_files_path(project_id)
        file_path = files_path / filename

        with open(file_path, "wb") as f:
            f.write(content)

        file_info = {
            "name": filename,
            "path": str(file_path.relative_to(self.storage_path)),
            "size": len(content),
            "uploaded_at": datetime.now().isoformat(),
        }

        project.files = [f for f in project.files if f["name"] != filename]
        project.files.append(file_info)
        self.save(project)
        return file_info

    def remove_file(self, project_id: str, filename: str) -> bool:
        project = self.load(project_id)
        if not project:
            return False

        files_path = self._project_files_path(project_id)
        file_path = files_path / filename

        if file_path.exists():
            file_path.unlink()

        project.files = [f for f in project.files if f["name"] != filename]
        self.save(project)
        return True

    def get_file_content(self, project_id: str, filename: str) -> Optional[bytes]:
        files_path = self._project_files_path(project_id)
        file_path = files_path / filename

        if not file_path.exists():
            return None

        with open(file_path, "rb") as f:
            return f.read()
