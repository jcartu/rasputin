from typing import Annotated, List, Literal, TypedDict
import operator

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import END, StateGraph

from .nodes import supervisor_node, coder_node, executor_node


MESSAGE_TYPES = (HumanMessage, AIMessage)


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    current_agent: str
    task_status: Literal["pending", "in_progress", "complete", "failed"]
    artifacts: dict


def route_to_agent(state: AgentState) -> str:
    if state["task_status"] == "complete":
        return END
    if state["task_status"] == "failed":
        return END
    return state["current_agent"]


def build_graph() -> StateGraph:
    builder = StateGraph(AgentState)

    builder.add_node("supervisor", supervisor_node)
    builder.add_node("coder", coder_node)
    builder.add_node("executor", executor_node)

    builder.set_entry_point("supervisor")

    builder.add_conditional_edges(
        "supervisor",
        route_to_agent,
        {
            "coder": "coder",
            "executor": "executor",
            END: END,
        },
    )

    builder.add_edge("coder", "supervisor")
    builder.add_edge("executor", "supervisor")

    return builder.compile()


graph = build_graph()
