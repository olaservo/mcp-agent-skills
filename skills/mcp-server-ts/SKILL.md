---
name: mcp-server-ts
description: Build TypeScript MCP servers with composable code snippets from the official Everything reference server. Use the add script to selectively copy tool, resource, or prompt modules. Use when creating MCP servers.
---

# TypeScript MCP Server Builder

Build MCP (Model Context Protocol) servers in TypeScript by referencing code snippets from the official Everything reference server.

## How It Works

1. **Browse** the snippet catalog below or in `snippets/`
2. **Copy** the snippets you need into your project
3. **Customize** the copied code for your use case
4. **Register** your tools/resources/prompts with the server

Snippets are bundled in this skill's `snippets/` directory.

---

## Quick Start Decision Trees

### What MCP Primitive Should I Use?

```
Need to perform actions with side effects?
  └─> Use TOOLS (model-controlled)
      Examples: API calls, file operations, computations

Need to expose data for LLM context?
  └─> Is data relatively static or URI-addressable?
      └─> Use RESOURCES (application-controlled)
          Examples: file contents, database records, API responses
  └─> Need parameterized access patterns?
      └─> Use Resource Templates with URI variables
          Example: myapp://users/{userId}/profile

Need user-initiated commands/slash commands?
  └─> Use PROMPTS (user-controlled)
      Examples: /summarize, /translate, /analyze
```

### What Transport Should I Use?

```
Local integration (subprocess, CLI, Claude Desktop)?
  └─> Use stdio transport (default)

Remote service, multi-client, or web deployment?
  └─> Use Streamable HTTP transport
```

> **Logging with stdio transport:** Never use `console.log()` in stdio servers - it writes to stdout, which is reserved for MCP protocol messages and will break communication. Use `console.error()` for all diagnostic output (it writes to stderr).

---

## Phase 1: Research

### 1.1 Identify Your Integration

Before writing code, understand:
- What API/service are you integrating?
- What operations do users need to perform?
- What data should be exposed to the LLM?

### 1.2 Browse Available Snippets

Review the snippet catalog below to identify patterns that match your needs:

| Snippet | Description | Best For |
|---------|-------------|----------|
| `server-setup` | Basic McpServer with stdio | Starting any new server |
| `tool-basic` | Simple tool with Zod schema | API calls, simple operations |
| `tool-progress` | Tool with progress notifications | Long-running operations |
| `tool-annotations` | Tool with semantic hints | Indicating read-only/destructive ops |
| `tool-output-schema` | Tool with structured output | Typed responses |
| `resource-static` | Static resource registration | Files, configs, static data |
| `resource-template` | Dynamic URI template resource | Parameterized data access |
| `prompt-basic` | Simple prompt | Basic user commands |
| `prompt-args` | Prompt with arguments | Parameterized commands |
| `tool-agentic-sampling` | Agentic tool with LLM sampling loop | Server-driven AI workflows |

### 1.3 Check Client Compatibility

Use the MCP docs server to look up current client capabilities:
- Query for "Example clients" to get a full list of clients and supported features
- Query for the client name that you'd like to use
- Check transport support (stdio vs Streamable HTTP)
- Verify feature support (tools, resources, prompts, sampling, etc.)

---

## Phase 2: Implement

### 2.1 Initialize Project

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
npx tsc --init
```

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

Update `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### 2.2 Add Snippets

Copy snippets from this skill's `snippets/` directory into your project. The snippets are organized by category:

```
snippets/
├── server/index.ts           # Server setup
├── tools/                    # Tool examples
│   ├── echo.ts
│   ├── trigger-long-running-operation.ts
│   ├── get-annotated-message.ts
│   └── get-structured-content.ts
├── resources/                # Resource examples
│   ├── files.ts
│   └── templates.ts
└── prompts/                  # Prompt examples
    ├── simple.ts
    └── args.ts
```

**Copy snippets directly:**
```bash
cp snippets/server/index.ts /path/to/my-mcp-server/src/
cp snippets/tools/echo.ts /path/to/my-mcp-server/src/
```

### 2.3 Customize and Register

Each snippet includes:
- Source URL linking to the original GitHub file
- Working code ready to customize

Modify the copied code:
1. Update tool/resource/prompt names
2. Adjust schemas for your API
3. Implement your business logic
4. Register with your server

---

## Phase 3: Test

### 3.1 Build

```bash
npm run build
```

### 3.2 Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest node dist/index.js
```

The Inspector lets you:
- List and call tools
- Browse resources
- Test prompts
- View server logs

### 3.3 Quality Checklist

- [ ] All tools have clear descriptions
- [ ] Input schemas validate correctly
- [ ] Error messages are actionable
- [ ] Long operations report progress
- [ ] Resources use appropriate MIME types

### 3.4 Writing Good Tool Descriptions

When an LLM client connects to your server, it uses your tool descriptions to decide which tools to call. Small refinements to descriptions can yield dramatic improvements in tool selection accuracy.

**Think like you're onboarding a new hire.** Make implicit context explicit—specialized query formats, niche terminology, and expected behaviors should all be clearly stated.

**Parameter naming matters:**
- Avoid generic names like `user` → use `user_id`
- Prefer semantic names (`file_type`) over technical ones (`mime_type`)
- Use natural language identifiers over cryptic codes

**Provide actionable error messages** that guide the agent toward correct usage, not opaque error codes.

```typescript
// Bad - vague description, unclear parameters
server.tool("process", { data: z.string() }, async ({ data }) => { ... });

// Good - clear purpose, descriptive parameters
server.tool(
  "convert_markdown_to_html",
  "Convert markdown text to HTML for rendering. Use when displaying user-generated content.",
  { markdown_text: z.string().describe("Raw markdown to convert") },
  async ({ markdown_text }) => { ... }
);
```

See: [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) for more guidance.

---

## Available Snippets Catalog

### Server Setup

| Name | Description |
|------|-------------|
| `server-setup` | Basic McpServer initialization with stdio transport, capabilities declaration, and clean shutdown |

### Tools

| Name | Description |
|------|-------------|
| `tool-basic` | Simple tool with Zod input schema (echo pattern) |
| `tool-progress` | Long-running operation with progress notifications |
| `tool-annotations` | Tool with readOnlyHint, destructiveHint, idempotentHint |
| `tool-output-schema` | Tool with structured output schema for typed responses |
| `tool-agentic-sampling` | Agentic tool using sampling with tools - LLM executes server tools in a loop (MCP 2025-11-25) |

### Resources

| Name | Description |
|------|-------------|
| `resource-static` | Static resource from files or fixed data |
| `resource-template` | Dynamic resource with URI template variables |

### Prompts

| Name | Description |
|------|-------------|
| `prompt-basic` | Simple prompt without arguments |
| `prompt-args` | Prompt with required/optional arguments and auto-completion |

---

## Reference Files

For deeper guidance, load these reference documents:

- [TypeScript SDK Patterns](./reference/typescript_sdk_patterns.md) - SDK imports, registration patterns, error handling
- [MCP Primitives Guide](./reference/mcp_primitives_guide.md) - Tool, Resource, Prompt specifications from MCP spec

---

## MCP Documentation Server

For up-to-date client compatibility info and protocol details, use the MCP docs server:

```json
{
  "mcpServers": {
    "mcp-docs": {
      "type": "http",
      "url": "https://modelcontextprotocol.io/mcp"
    }
  }
}
```

This provides live access to:
- Client capability matrices
- Protocol specification updates
- SDK documentation
- Best practices

---

## External Resources

- [MCP Specification](https://modelcontextprotocol.io/specification) - Official protocol documentation
- [Everything Server](https://github.com/modelcontextprotocol/servers/tree/main/src/everything) - Reference implementation (snippet source)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK repository
- [MCP Inspector](https://www.npmjs.com/package/@modelcontextprotocol/inspector) - Testing tool
