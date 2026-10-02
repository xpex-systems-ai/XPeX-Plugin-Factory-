"""Connect CrewAI to the live XPeX MCP offer without starting an LLM or payment.

Install: pip install 'crewai-tools[mcp]'
Run:     python examples/crewai_xpex.py
Pass the selected `offer` tool in an Agent(tools=[offer], ...) inside your crew.
"""

import os

from crewai_tools import MCPServerAdapter

MCP_URL = os.getenv("XPEX_MCP_URL", "https://xpex-plugin-factory-production.up.railway.app/mcp")
OFFER_TOOL = "xpex_factory_get_agent_kit_offer"


def main() -> None:
    with MCPServerAdapter({"url": MCP_URL, "transport": "streamable-http"}) as tools:
        # CrewAI may prefix MCP tool names to avoid collisions across servers.
        offer = next((tool for tool in tools if tool.name.endswith(OFFER_TOOL)), None)
        if offer is None:
            raise RuntimeError(f"Missing MCP tool {OFFER_TOOL}; available: {[t.name for t in tools]}")
        print(f"CrewAI MCP connected: {offer.name}")
        print("Attach this tool to an Agent(tools=[offer], ...) to use it in a crew.")


if __name__ == "__main__":
    main()
