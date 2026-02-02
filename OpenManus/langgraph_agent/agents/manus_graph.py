from typing import Literal, Callable, Awaitable, Optional
from datetime import datetime
import uuid
import json

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

from ..state.agent_state import (
    AgentState, Task, TaskStatus, BrowserState, 
    create_initial_state, FileInfo
)
from ..tools.browser_tool import BrowserTools, create_browser_tool
from ..tools.file_tools import FileTools, create_file_tools
from ..tools.shell_tool import ShellTools, create_shell_tool


SYSTEM_PROMPT = """You are Manus, a highly capable AI agent that can browse the web, write code, manage files, and execute tasks autonomously.

When given a task:
1. First, break it down into clear subtasks and announce your plan
2. Execute each subtask methodically using the available tools
3. Provide progress updates as you work
4. When complete, summarize what was accomplished

Available tools:
- browser_use: Navigate websites, click, type, scroll, take screenshots
- read_file, write_file, list_files, delete_file: File operations
- run_shell: Execute shell commands

Always be thorough and verify your work. If something fails, try alternative approaches.
When browsing the web, extract relevant information and save important content to files.

Format your task plan as a numbered list like:
1. [Task title]
2. [Task title]
...

Update on progress after each major step."""


class ManusAgent:
    def __init__(
        self,
        api_key: str,
        model: str = "claude-sonnet-4-20250514",
        workspace_path: str = "/tmp/manus-workspace",
        on_event: Optional[Callable[[str, dict], Awaitable[None]]] = None
    ):
        self.on_event = on_event
        self.workspace_path = workspace_path
        
        self.browser_tools = BrowserTools(on_screenshot=self._on_screenshot)
        self.file_tools = FileTools(workspace_path)
        self.shell_tools = ShellTools(workspace_path)
        
        browser_tool = create_browser_tool(self.browser_tools)
        file_tools = create_file_tools(self.file_tools)
        shell_tool = create_shell_tool(self.shell_tools)
        
        self.tools = [browser_tool] + file_tools + [shell_tool]
        
        self.llm = ChatAnthropic(
            model=model,
            api_key=api_key,
            max_tokens=4096
        ).bind_tools(self.tools)
        
        self.checkpointer = MemorySaver()
        self.graph = self._build_graph()
        self._latest_screenshot = None

    async def _on_screenshot(self, screenshot_b64: str):
        self._latest_screenshot = screenshot_b64
        if self.on_event:
            await self.on_event("screenshot", {"base64_image": screenshot_b64})

    async def _emit(self, event_type: str, data: dict):
        if self.on_event:
            await self.on_event(event_type, data)

    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(AgentState)
        
        workflow.add_node("planner", self._planner_node)
        workflow.add_node("executor", self._executor_node)
        workflow.add_node("tools", ToolNode(self.tools))
        workflow.add_node("check_completion", self._check_completion_node)
        
        workflow.set_entry_point("planner")
        
        workflow.add_edge("planner", "executor")
        workflow.add_conditional_edges(
            "executor",
            self._should_use_tools,
            {
                "tools": "tools",
                "check": "check_completion",
            }
        )
        workflow.add_edge("tools", "executor")
        workflow.add_conditional_edges(
            "check_completion",
            self._is_complete,
            {
                "continue": "executor",
                "end": END,
            }
        )
        
        return workflow.compile(checkpointer=self.checkpointer)

    async def _planner_node(self, state: AgentState) -> dict:
        await self._emit("status", {"state": "planning"})
        
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            *state["messages"]
        ]
        
        response = await self.llm.ainvoke(messages)
        
        tasks = self._extract_tasks(response.content)
        
        if tasks:
            await self._emit("task_plan", {
                "tasks": [t.to_dict() for t in tasks]
            })
        
        await self._emit("thought", {"content": response.content})
        
        return {
            "messages": [response],
            "tasks": tasks,
            "step_count": state["step_count"] + 1
        }

    async def _executor_node(self, state: AgentState) -> dict:
        await self._emit("step_start", {
            "step": state["step_count"],
            "max_steps": state["max_steps"]
        })
        
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            *state["messages"]
        ]
        
        response = await self.llm.ainvoke(messages)
        
        if response.content:
            await self._emit("thought", {"content": response.content})
        
        if response.tool_calls:
            tool_names = [tc["name"] for tc in response.tool_calls]
            await self._emit("tools_selected", {"tools": tool_names})
            for tc in response.tool_calls:
                await self._emit("tool_start", {
                    "name": tc["name"],
                    "args": tc.get("args", {})
                })
        
        return {
            "messages": [response],
            "step_count": state["step_count"] + 1
        }

    async def _check_completion_node(self, state: AgentState) -> dict:
        last_message = state["messages"][-1]
        
        if state["step_count"] >= state["max_steps"]:
            await self._emit("complete", {"success": True, "reason": "max_steps_reached"})
            return {"is_complete": True, "final_answer": "Task stopped: maximum steps reached"}
        
        if isinstance(last_message, AIMessage) and not last_message.tool_calls:
            if any(phrase in last_message.content.lower() for phrase in 
                   ["task complete", "finished", "done", "completed successfully"]):
                await self._emit("complete", {"success": True})
                return {"is_complete": True, "final_answer": last_message.content}
        
        return {"is_complete": False}

    def _should_use_tools(self, state: AgentState) -> Literal["tools", "check"]:
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return "check"

    def _is_complete(self, state: AgentState) -> Literal["continue", "end"]:
        if state.get("is_complete", False):
            return "end"
        return "continue"

    def _extract_tasks(self, content: str) -> list[Task]:
        tasks = []
        lines = content.split("\n")
        for line in lines:
            line = line.strip()
            if line and len(line) > 2:
                if line[0].isdigit() and (line[1] == '.' or line[1] == ')'):
                    title = line[2:].strip().lstrip('. ')
                    if title:
                        tasks.append(Task(
                            id=str(uuid.uuid4())[:8],
                            title=title,
                            status=TaskStatus.PENDING
                        ))
        return tasks

    async def run(self, user_message: str, thread_id: str = None) -> AgentState:
        initial_state = create_initial_state(user_message)
        initial_state["workspace_path"] = self.workspace_path
        
        config = {"configurable": {"thread_id": thread_id or str(uuid.uuid4())}}
        
        try:
            final_state = await self.graph.ainvoke(initial_state, config)
            return final_state
        finally:
            await self.cleanup()

    async def cleanup(self):
        await self.browser_tools.cleanup()

    def get_files(self) -> list[dict]:
        import os
        files = []
        for root, dirs, filenames in os.walk(self.workspace_path):
            for name in filenames:
                path = os.path.join(root, name)
                rel_path = os.path.relpath(path, self.workspace_path)
                files.append({
                    "name": name,
                    "path": rel_path,
                    "is_dir": False,
                    "size": os.path.getsize(path)
                })
            for name in dirs:
                path = os.path.join(root, name)
                rel_path = os.path.relpath(path, self.workspace_path)
                files.append({
                    "name": name,
                    "path": rel_path,
                    "is_dir": True,
                    "size": 0
                })
        return files
