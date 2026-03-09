from langchain_core.messages import AIMessage


def coder_node(state: dict) -> dict:
    """Generate code based on the task."""
    messages = state.get("messages", [])
    if messages:
        pass

    # Placeholder - will integrate with Anthropic Claude
    response = "```python\n# Code will be generated here\nprint('Hello from JARVIS!')\n```"

    return {
        "messages": [AIMessage(content=f"Generated code:\n{response}")],
        "task_status": "complete",
        "artifacts": {"code": response},
    }
