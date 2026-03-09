from langchain_core.messages import AIMessage
import os


def supervisor_node(state: dict) -> dict:
    """Analyze task and route to appropriate agent."""
    messages = state.get("messages", [])
    _ = os.getenv("JARVIS_SUPERVISOR", "")
    if not messages:
        return {
            "current_agent": "coder",
            "task_status": "complete",
            "messages": [AIMessage(content="No messages to process")],
        }

    last_message = messages[-1].content.lower() if messages else ""

    # Simple routing logic (will be enhanced with LLM)
    if any(word in last_message for word in ["code", "write", "implement", "create"]):
        return {"current_agent": "coder", "task_status": "in_progress"}
    elif any(word in last_message for word in ["run", "execute", "test"]):
        return {"current_agent": "executor", "task_status": "in_progress"}
    else:
        return {
            "current_agent": "coder",
            "task_status": "complete",
            "messages": [
                AIMessage(content="I understand your request. How can I help?")
            ],
        }
