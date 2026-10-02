# LangChain and CrewAI: connect to the live Factory

The production MCP endpoint is `https://xpex-plugin-factory-production.up.railway.app/mcp`.
Its free `xpex_factory_get_agent_kit_offer` tool returns the x402 API URL,
price, network and example input. Discovering the offer does **not** purchase
the kit. The paid API is `POST /v1/x402/agent-kit` at 0.01 USDC on Base.

## LangChain

Run `pip install 'langchain[mcp]>=1.4.0'` and then
`python examples/langchain_xpex.py`. The example opens a real Streamable HTTP
connection, lists the tools and invokes the free offer discovery tool. To give
tools to an LLM agent, use `create_agent(model, tools)` after `list_tools()`;
configure your own model and its billing separately.

## CrewAI

Run `pip install 'crewai-tools[mcp]'` and then
`python examples/crewai_xpex.py`. It opens the MCP adapter and selects the
offer tool. In a crew, attach that tool to `Agent(tools=[offer], ...)` while
the adapter context remains open. CrewAI also supports the `mcps` field with
`MCPServerHTTP(url=..., streamable=True)` for automatic tool discovery.
Starting a crew may incur your model provider's charges.

## Payment boundary

An agent that wants a kit must first validate the public HTTPS MCP URL and
product details, request the x402 endpoint without a signature, inspect the
`402` payment requirements, and obtain authorization from its buyer wallet
before retrying with `PAYMENT-SIGNATURE`. Do not put private keys, API secrets,
or customer data in the blueprint. The Factory never counts discovery or an
unpaid `402` as settled revenue. See [agent payment integration](AGENT-PAYMENTS.md).

Framework references: [LangChain MCP](https://docs.langchain.com/oss/python/langchain/mcp)
and [CrewAI MCP](https://docs.crewai.com/en/mcp/overview).
