from typing import Literal, Callable, Awaitable, Optional, Any, Union
from datetime import datetime
import uuid
import json
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver


def get_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for item in content:
            if isinstance(item, str):
                texts.append(item)
            elif isinstance(item, dict) and "text" in item:
                texts.append(str(item["text"]))
        return " ".join(texts)
    return str(content)

from ..state.agent_state import (
    AgentState, Task, TaskStatus, BrowserState, AgentMode,
    create_initial_state, FileInfo
)
from ..tools.browser_tool import BrowserTools, create_browser_tool
from ..tools.file_tools import FileTools, create_file_tools
from ..tools.shell_tool import ShellTools, create_shell_tool


AGENT_SYSTEM_PROMPT = """You are Manus, a highly capable AI agent that can browse the web, write code, manage files, and execute tasks autonomously.

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

CHAT_SYSTEM_PROMPT = """You are Manus, a helpful AI assistant. You're having a conversation with the user.

Respond naturally and helpfully. You can:
- Answer questions on any topic
- Help with brainstorming and ideation
- Explain concepts and provide information
- Have casual conversations
- Offer advice and suggestions

Be concise but thorough. If a task requires autonomous execution (browsing, coding, file creation), let the user know you can help with that in Agent mode."""

ROUTER_PROMPT = """Analyze this user message and determine if it requires autonomous agent execution or can be handled as a simple chat response.

AGENT MODE is needed when the user wants to:
- Browse websites or search the web
- Create, edit, or manage files
- Run code or shell commands
- Build websites, apps, or documents
- Perform multi-step tasks that require tools
- Research and compile information from multiple sources

CHAT MODE is sufficient when the user wants to:
- Ask questions or get explanations
- Have a conversation or discussion
- Brainstorm or get ideas
- Get quick answers or information
- Casual chat or small talk

User message: "{message}"

Respond with ONLY one word: either "agent" or "chat"."""


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
        self.api_key = api_key
        self.model = model
        
        self.browser_tools = BrowserTools(on_screenshot=self._on_screenshot)
        self.file_tools = FileTools(workspace_path)
        self.shell_tools = ShellTools(workspace_path, on_output=self._on_terminal_output)
        
        browser_tool = create_browser_tool(self.browser_tools)
        file_tools = create_file_tools(self.file_tools)
        shell_tool = create_shell_tool(self.shell_tools)
        
        self.tools = [browser_tool] + file_tools + [shell_tool]
        
        self.agent_llm = ChatAnthropic(
            model_name=model,
            api_key=api_key,
            max_tokens_to_sample=4096
        ).bind_tools(self.tools)
        
        self.chat_llm = ChatAnthropic(
            model_name=model,
            api_key=api_key,
            max_tokens_to_sample=4096
        )
        
        self.router_llm = ChatAnthropic(
            model_name="claude-3-5-haiku-20241022",
            api_key=api_key,
            max_tokens_to_sample=10
        )
        
        self.checkpointer = MemorySaver()
        self.graph = self._build_graph()
        self._latest_screenshot = None

    async def _on_screenshot(self, screenshot_b64: str):
        self._latest_screenshot = screenshot_b64
        if self.on_event:
            await self.on_event("screenshot", {"base64_image": screenshot_b64})

    async def _on_terminal_output(self, output_type: str, command: str, content: str):
        if self.on_event:
            await self.on_event("terminal_output", {
                "type": output_type,
                "command": command,
                "content": content
            })

    async def _emit(self, event_type: str, data: dict):
        if self.on_event:
            await self.on_event(event_type, data)

    def _build_system_prompt(self, base_prompt: str, state: AgentState) -> str:
        project_instructions = state.get("project_instructions")
        if project_instructions:
            return f"{base_prompt}\n\n## Project Instructions\n\nThe user has provided the following instructions for this project that you should follow:\n\n{project_instructions}"
        return base_prompt

    def _build_graph(self) -> Any:
        workflow = StateGraph(AgentState)
        
        workflow.add_node("router", self._router_node)
        workflow.add_node("chat_response", self._chat_response_node)
        workflow.add_node("planner", self._planner_node)
        workflow.add_node("executor", self._executor_node)
        workflow.add_node("tools", ToolNode(self.tools))
        workflow.add_node("check_completion", self._check_completion_node)
        
        workflow.set_entry_point("router")
        
        workflow.add_conditional_edges(
            "router",
            self._route_by_mode,
            {
                "chat": "chat_response",
                "agent": "planner",
            }
        )
        
        workflow.add_edge("chat_response", END)
        
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

    async def _router_node(self, state: AgentState) -> dict:
        mode = state.get("mode", "adaptive")
        
        if mode == "chat":
            await self._emit("mode_selected", {"mode": "chat", "reason": "User forced chat mode"})
            return {"routed_to": "chat"}
        
        if mode == "agent":
            await self._emit("mode_selected", {"mode": "agent", "reason": "User forced agent mode"})
            return {"routed_to": "agent"}
        
        await self._emit("status", {"state": "routing"})
        
        user_message = ""
        for msg in reversed(state["messages"]):
            if isinstance(msg, HumanMessage):
                content = msg.content
                user_message = content if isinstance(content, str) else str(content)
                break
        
        quick_result = self._quick_classify(user_message)
        if quick_result == "chat":
            await self._emit("mode_selected", {"mode": "chat", "reason": "Simple query detected"})
            return {"routed_to": "chat"}
        
        if quick_result == "agent":
            await self._emit("mode_selected", {"mode": "agent", "reason": "Action request detected"})
            return {"routed_to": "agent"}
        
        try:
            prompt = ROUTER_PROMPT.format(message=user_message[:500])
            response = await self.router_llm.ainvoke([HumanMessage(content=prompt)])
            resp_content = response.content
            decision = (resp_content if isinstance(resp_content, str) else str(resp_content)).strip().lower()
            
            if "agent" in decision:
                await self._emit("mode_selected", {"mode": "agent", "reason": "LLM classification"})
                return {"routed_to": "agent"}
            else:
                await self._emit("mode_selected", {"mode": "chat", "reason": "LLM classification"})
                return {"routed_to": "chat"}
        except Exception:
            await self._emit("mode_selected", {"mode": "agent", "reason": "Classification fallback"})
            return {"routed_to": "agent"}

    def _quick_classify(self, message: str) -> Optional[str]:
        msg_lower = message.lower().strip()
        
        agent_patterns = [
            r"\b(create|build|make|write|generate)\b.*(website|app|file|code|script|page)",
            r"\b(browse|search|go to|visit|open)\b.*(web|site|url|http|www)",
            r"\b(download|save|export)\b",
            r"\b(run|execute|install)\b.*(command|script|code)",
            r"\b(edit|modify|update|change)\b.*(file|code)",
            r"\bcreate\s+(a|an|the)\s+\w+\s+(for|that|which)",
        ]
        
        for pattern in agent_patterns:
            if re.search(pattern, msg_lower):
                return "agent"
        
        chat_patterns = [
            r"^(what|who|when|where|why|how|is|are|can|could|would|should|do|does|did)\b",
            r"^(hi|hello|hey|thanks|thank you|please)\b",
            r"^(explain|tell me|describe|what is|what are)\b",
            r"\?$",
        ]
        
        for pattern in chat_patterns:
            if re.search(pattern, msg_lower):
                if not any(re.search(ap, msg_lower) for ap in agent_patterns):
                    return "chat"
        
        return None

    def _route_by_mode(self, state: AgentState) -> Literal["chat", "agent"]:
        routed = state.get("routed_to")
        if routed == "chat":
            return "chat"
        return "agent"

    async def _chat_response_node(self, state: AgentState) -> dict:
        await self._emit("status", {"state": "thinking"})
        
        system_prompt = self._build_system_prompt(CHAT_SYSTEM_PROMPT, state)
        messages = [
            SystemMessage(content=system_prompt),
            *state["messages"]
        ]
        
        response = await self.chat_llm.ainvoke(messages)
        
        await self._emit("thought", {"content": response.content})
        await self._emit("complete", {"success": True, "mode": "chat"})
        
        return {
            "messages": [response],
            "is_complete": True,
            "final_answer": response.content,
        }

    async def _planner_node(self, state: AgentState) -> dict:
        await self._emit("status", {"state": "planning"})
        
        system_prompt = self._build_system_prompt(AGENT_SYSTEM_PROMPT, state)
        messages = [
            SystemMessage(content=system_prompt),
            *state["messages"]
        ]
        
        response = await self.agent_llm.ainvoke(messages)
        content_text = get_message_text(response.content)
        
        tasks = self._extract_tasks(content_text)
        
        if tasks:
            await self._emit("task_plan", {
                "tasks": [t.to_dict() for t in tasks]
            })
        
        await self._emit("thought", {"content": content_text})
        
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
        
        system_prompt = self._build_system_prompt(AGENT_SYSTEM_PROMPT, state)
        messages = [
            SystemMessage(content=system_prompt),
            *state["messages"]
        ]
        
        response = await self.agent_llm.ainvoke(messages)
        
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
            await self._emit("complete", {"success": True, "reason": "max_steps_reached", "mode": "agent"})
            return {"is_complete": True, "final_answer": "Task stopped: maximum steps reached"}
        
        if isinstance(last_message, AIMessage) and not last_message.tool_calls:
            content_text = get_message_text(last_message.content)
            if any(phrase in content_text.lower() for phrase in 
                   ["task complete", "finished", "done", "completed successfully"]):
                await self._emit("complete", {"success": True, "mode": "agent"})
                return {"is_complete": True, "final_answer": content_text}
        
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

    async def run(
        self, 
        user_message: str, 
        thread_id: Optional[str] = None, 
        mode: str = "adaptive",
        project_instructions: str = ""
    ) -> AgentState:
        initial_state = create_initial_state(
            user_message, 
            mode=mode, 
            project_instructions=project_instructions
        )
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
