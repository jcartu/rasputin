from typing import TypedDict, Annotated, Sequence, Literal, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import operator

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


@dataclass
class Task:
    id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    parent_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "parent_id": self.parent_id,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error": self.error,
        }


@dataclass
class FileInfo:
    path: str
    name: str
    is_dir: bool = False
    size: int = 0
    modified_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "name": self.name,
            "is_dir": self.is_dir,
            "size": self.size,
            "modified_at": self.modified_at.isoformat() if self.modified_at else None,
        }


@dataclass 
class BrowserState:
    url: str = ""
    title: str = ""
    screenshot_base64: Optional[str] = None
    is_loading: bool = False
    tabs: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "title": self.title,
            "has_screenshot": self.screenshot_base64 is not None,
            "is_loading": self.is_loading,
            "tabs": self.tabs,
        }


def add_messages(left: list[BaseMessage], right: list[BaseMessage]) -> list[BaseMessage]:
    return left + right


def merge_tasks(left: list[Task], right: list[Task]) -> list[Task]:
    task_map = {t.id: t for t in left}
    for task in right:
        task_map[task.id] = task
    return list(task_map.values())


class AgentMode(str, Enum):
    ADAPTIVE = "adaptive"
    CHAT = "chat"
    AGENT = "agent"


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    tasks: Annotated[list[Task], merge_tasks]
    current_task_id: Optional[str]
    browser: BrowserState
    files: list[FileInfo]
    workspace_path: str
    vnc_url: Optional[str]
    website_url: Optional[str]
    sandbox_id: Optional[str]
    step_count: int
    max_steps: int
    is_complete: bool
    final_answer: Optional[str]
    error: Optional[str]
    human_input_needed: bool
    human_input_reason: Optional[str]
    mode: str
    routed_to: Optional[str]


def create_initial_state(user_message: str, mode: str = "adaptive") -> AgentState:
    return AgentState(
        messages=[HumanMessage(content=user_message)],
        tasks=[],
        current_task_id=None,
        browser=BrowserState(),
        files=[],
        workspace_path="/workspace",
        vnc_url=None,
        website_url=None,
        sandbox_id=None,
        step_count=0,
        max_steps=30,
        is_complete=False,
        final_answer=None,
        error=None,
        human_input_needed=False,
        human_input_reason=None,
        mode=mode,
        routed_to=None,
    )
