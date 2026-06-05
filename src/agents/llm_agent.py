"""ONOS LLM Agent for SDN network management."""
import os
import json
import asyncio
from dotenv import load_dotenv
from openai import OpenAI
from typing import Callable

load_dotenv()


class LLMAgent:
    """LLM-powered agent that reasons about user intent and selects appropriate ONOS tools."""

    SYSTEM_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
    
    def __init__(self):
        # Load system prompt if available
        if os.path.exists(self.SYSTEM_PROMPT_PATH):
            with open(self.SYSTEM_PROMPT_PATH, "r") as f:
                self.SYSTEM_PROMPT = f.read()
        else:
            self.SYSTEM_PROMPT = self._get_default_system_prompt()
        
        self.client = OpenAI(
            api_key=os.getenv("API_KEY", "dummy"),
            base_url=os.getenv("API_BASE_URL", "http://localhost:11434/v1"),
        )
        self.model = os.getenv("MODEL", "minimax-m2.5:cloud")
        self.tools: dict[str, Callable] = {}

    def _get_default_system_prompt(self) -> str:
        """Return default system prompt for network management."""
        return """You are an expert SDN (Software-Defined Networking) agent for ONOS network management.
You understand network topology, device management, flow configuration, and network diagnostics.

When the user requests network operations, you should:
1. Understand their intent
2. Select appropriate ONOS tools to execute
3. Format your response as JSON with tool name and parameters

Respond in JSON format:
{
    "tool": "tool_name",
    "params": {"param1": "value1"},
    "message": "explanation"
}

For non-tool responses (general questions), use:
{
    "tool": "none",
    "message": "your response"
}

Available tools and their parameters will be provided in context."""

    def register_tool(self, name: str, func: Callable):
        """Register an MCP tool for execution."""
        self.tools[name] = func

    def register_tools(self, tools: dict[str, Callable]):
        """Register multiple tools at once."""
        self.tools.update(tools)

    async def process(self, user_input: str) -> str:
        """Process user input: reason about intent, select and execute appropriate tool."""
        available_tools_info = "\n".join([f"- {name}" for name in self.tools.keys()])
        prompt = f"""{self.SYSTEM_PROMPT}

Available tools:
{available_tools_info}

User request: {user_input}"""
        
        # Run sync OpenAI call in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_input},
                ],
                temperature=0,
            )
        )

        response_text = (response.choices[0].message.content or "").strip()
        if not response_text:
            return "No response from LLM."

        action = self._parse_action(response_text)
        if not action:
            return f"Could not parse response: {response_text}"

        tool_name = action.get("tool")

        # non-tool response
        if tool_name == "none" or not tool_name:
            return action.get("message", response_text)
        
        # execute tool
        return await self._execute_action(action)
        
    def _parse_action(self, response: str) -> dict | None:
        """Extract JSON action from LLM response."""
        try:
            # Try direct JSON parse first
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        try:
            # Find JSON block in response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
        except json.JSONDecodeError:
            pass
        return None

    async def _execute_action(self, action: dict) -> str:
        """Execute the requested tool action."""
        tool_name = action.get("tool")
        params = action.get("params", {})

        if tool_name not in self.tools:
            return f"Unknown tool: {tool_name}. Available: {list(self.tools.keys())}"

        try:
            result = self.tools[tool_name](**params)
            # Handle async functions
            if asyncio.iscoroutine(result):
                result = await result
            return f"{tool_name}: {result}"
        except Exception as e:
            return f"Error in {tool_name}: {e}"
