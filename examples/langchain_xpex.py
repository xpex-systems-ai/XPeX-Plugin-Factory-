"""Discover the live XPeX x402 offer through LangChain's MCP adapter.

Install: pip install 'langchain[mcp]>=1.4.0'
Run:     python examples/langchain_xpex.py
This calls a free discovery tool; it never submits a payment signature.
"""

import asyncio

import os

from langchain.mcp import MCPAdapter

MCP_URL = os.getenv("XPEX_MCP_URL", "https://xpex-plugin-factory-production.up.railway.app/mcp")
OFFER_TOOL = "xpex_factory_get_agent_kit_offer"


async def main() -> None:
    async with MCPAdapter(MCP_URL) as adapter:
        tools = await adapter.list_tools()
        offer = next((tool for tool in tools if tool.name == OFFER_TOOL), None)
        if offer is None:
            raise RuntimeError(f"Missing MCP tool {OFFER_TOOL}; available: {[t.name for t in tools]}")
        print(await offer.ainvoke({}))


if __name__ == "__main__":
    asyncio.run(main())
