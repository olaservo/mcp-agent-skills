---
name: mcp-apps-ts
description: Build interactive HTML UIs for MCP servers using the MCP Apps extension (SEP-1865). Covers server-side tool registration with UI resources, client-side App lifecycle, and host integration via AppBridge. Use when creating visual interfaces for MCP tools.
---

# TypeScript MCP Apps Builder

Build interactive HTML UIs for MCP tools using the MCP Apps extension (SEP-1865).

**This is an experimental extension.** MCP Apps enables servers to deliver interactive HTML UIs that run in sandboxed iframes, allowing rich visual interfaces while maintaining security.

> **Tip: Stay up to date!** MCP Apps is under active development. Before starting, check the [ext-apps repository](https://github.com/modelcontextprotocol/ext-apps) for:
> - [Open Pull Requests](https://github.com/modelcontextprotocol/ext-apps/pulls) - upcoming changes
> - [Issues](https://github.com/modelcontextprotocol/ext-apps/issues) - known bugs and feature requests
> - [Recent Commits](https://github.com/modelcontextprotocol/ext-apps/commits/main) - latest changes

## How It Works

1. **Browse** the snippet catalog below or in `snippets/`
2. **Identify** your role: server developer, app developer, or host integrator
3. **Copy** the snippets you need into your project
4. **Customize** the copied code for your use case

---

## Quick Start Decision Trees

### What Role Are You Building?

```
Building an MCP server that provides tools with UIs?
  └─> Start with SERVER snippets
      - tool-with-ui: Register tool with associated HTML UI
      - tool-with-structured: Return structured content
      - resource-with-csp: Add Content Security Policy

Building the HTML UI that displays to users?
  └─> Start with APP snippets
      - app-vanilla-basic: Simple App class setup (vanilla JS)
      - app-vanilla-full: Full lifecycle (vanilla JS)
      - app-react-basic: React hooks integration
      - tool-calling: Call back to server tools

Building a host/client that embeds MCP app UIs?
  └─> Start with HOST snippets
      - host-full-integration: Complete end-to-end flow
      - sandbox-proxy: Required for security
      - app-bridge-basic: Just the AppBridge setup
      - app-bridge-handlers: Full handlers setup
```

### Which App Framework Should I Use?

```
Minimal dependencies, simple UI?
  └─> Use Vanilla JS snippets
      - app-vanilla-basic for getting started
      - app-vanilla-full for full control

React-based UI with state management?
  └─> Use React snippets
      - app-react-basic for hooks integration
```

---

## Phase 1: Research

### 1.1 Understand MCP Apps Architecture

MCP Apps uses a **two-part registration pattern**: Tool + UI Resource.

| Component | Package | Role |
|-----------|---------|------|
| **Server** | `@modelcontextprotocol/sdk` + `ext-apps/server` | Register tools with `ui://` resources |
| **App** | `@modelcontextprotocol/ext-apps` | HTML UI running in sandbox iframe |
| **Host** | `@modelcontextprotocol/ext-apps/app-bridge` | Embeds and manages app iframes |

### 1.2 Key Concepts

- **`ui://` URI Scheme**: Tools reference UI resources via `ui://tool-name/app.html` URIs
- **`RESOURCE_URI_META_KEY`**: Constant for linking tools to UIs in `_meta`
- **`RESOURCE_MIME_TYPE`**: `text/html;profile=mcp-app` identifies MCP App resources
- **PostMessageTransport**: Communication between app iframe and host
- **Double-iframe Sandboxing**: Outer iframe isolates, inner iframe runs app with `allow-scripts`

### 1.3 Browse Available Snippets

| Snippet | Description | Best For |
|---------|-------------|----------|
| `tool-with-ui` | Tool with UI resource registration | Basic server setup |
| `tool-with-structured` | Tool returning structuredContent | Rich data responses |
| `resource-with-csp` | UI resource with CSP metadata | Security-conscious apps |
| `app-vanilla-basic` | Basic App class (vanilla JS) | Quick prototypes |
| `app-vanilla-full` | Full lifecycle handlers | Production apps |
| `app-react-basic` | React hooks integration | React projects |
| `tool-calling` | Call MCP tools from app | Interactive UIs |
| `app-bridge-basic` | Basic host embedding | Simple integration |
| `app-bridge-handlers` | Full AppBridge handlers | Custom hosts |
| `host-full-integration` | Complete host flow | End-to-end hosting |
| `sandbox-proxy` | Sandbox proxy HTML | Host security |

---

## Phase 2: Implement

### 2.1 Server-Side: Register Tool with UI

```bash
npm install @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps zod
```

Copy the `tool-with-ui` snippet and customize:
1. Define your tool's input schema
2. Create the UI resource HTML content
3. Link tool to UI via `ui://` URI and `RESOURCE_URI_META_KEY`

> **See also:** For MCP server basics (transports, tool registration patterns), refer to the **mcp-server-ts** skill.

### 2.2 App-Side: Build the UI

**Vanilla JS:**
```bash
npm install @modelcontextprotocol/ext-apps
```

**React:**
```bash
npm install @modelcontextprotocol/ext-apps react react-dom
```

Copy the appropriate app snippet and implement:
1. Initialize App with name and version
2. Register handlers BEFORE calling `connect()`
3. Handle `ontoolresult` for tool execution results
4. Call tools via `app.callServerTool()`

### 2.3 Host-Side: Embed Apps (Optional)

```bash
npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk
```

Copy the `host-full-integration` snippet for the complete flow, or start with `app-bridge-basic` for just the AppBridge setup:
1. Connect MCP client to server (see **mcp-client-ts** skill)
2. Create AppBridge with the connected client
3. Set up sandbox proxy iframe (use `sandbox-proxy` snippet)
4. Register handlers before connecting
5. Load UI resource and initialize app

> **Critical:** The App initiates `ui/initialize`, the Host responds! If building without AppBridge SDK, you must handle the request/response correctly. See "Common Pitfalls" in the Architecture reference.

> **See also:** For MCP client basics (connecting to servers, calling tools), refer to the **mcp-client-ts** skill.

---

## Phase 3: Test

### 3.1 Build All Components

```bash
# Build UI (using Vite with vite-plugin-singlefile)
npm run build

# Start MCP server
npm run serve
```

### 3.2 Test with Reference Host

```bash
# Clone ext-apps repo for test host
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps/examples/basic-host
npm install && npm start
# Open http://localhost:8080
```

### 3.3 Quality Checklist

- [ ] Tool correctly registers with `ui://` resource
- [ ] `RESOURCE_MIME_TYPE` is `text/html;profile=mcp-app`
- [ ] App initializes without errors
- [ ] Handlers registered BEFORE `connect()`
- [ ] `ontoolresult` receives tool execution results
- [ ] `callServerTool()` successfully calls server
- [ ] CSP is properly declared (if using)

---

## Available Snippets Catalog

### Server (MCP Server with UI)

| Name | Description |
|------|-------------|
| `tool-with-ui` | Register MCP tool with UI resource using `registerAppTool` and `registerAppResource` |
| `tool-with-structured` | Tool returning `structuredContent` for typed responses |
| `resource-with-csp` | UI resource with Content Security Policy metadata |

### App (HTML UI in iframe)

| Name | Description |
|------|-------------|
| `app-vanilla-basic` | Basic App class with `ontoolresult` handler (vanilla JS) |
| `app-vanilla-full` | Full lifecycle: `ontoolresult`, `ontoolinput`, `onteardown`, `onerror`, messaging |
| `app-react-basic` | React component with `useApp` hook |
| `tool-calling` | Examples of calling MCP tools from app UI |

### Host (Embedding Apps)

| Name | Description |
|------|-------------|
| `app-bridge-basic` | Basic AppBridge setup with PostMessageTransport |
| `app-bridge-handlers` | Full handlers: `onmessage`, `onopenlink`, `onloggingmessage`, `onsizechange` |
| `host-full-integration` | Complete flow: MCP client + tool call + UI detection + AppBridge |
| `sandbox-proxy` | Sandbox proxy HTML for double-iframe security |

---

## Reference Files

For deeper guidance, load these reference documents:

- [MCP Apps Architecture](./reference/mcp_apps_architecture.md) - Component overview, data flow, security, **common pitfalls**
- [MCP Apps API Reference](./reference/mcp_apps_api_reference.md) - Full API documentation

> **Important:** Read the "Common Pitfalls" section in the Architecture doc before implementing a host. Key issues include srcdoc iframe origins, protocol direction, and message sequencing.

---

## SDK Packages

| Package | Import Path | Purpose |
|---------|-------------|---------|
| Main SDK | `@modelcontextprotocol/ext-apps` | App class, types |
| Server helpers | `@modelcontextprotocol/ext-apps/server` | `registerAppTool`, `registerAppResource` |
| React | `@modelcontextprotocol/ext-apps/react` | `useApp` hook |
| App Bridge | `@modelcontextprotocol/ext-apps/app-bridge` | AppBridge for hosts |

---

## External Resources

- [MCP Apps SDK Repository](https://github.com/modelcontextprotocol/ext-apps)
- [Quickstart Guide](https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html)
- [API Documentation](https://modelcontextprotocol.github.io/ext-apps/api/)
- [SEP-1865 Specification](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
