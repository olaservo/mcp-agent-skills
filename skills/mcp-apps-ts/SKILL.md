---
name: mcp-apps-ts
description: Develop MCP Apps hosts (AppBridge) and access comprehensive MCP Apps reference documentation. Covers host embedding, multi-server routing, sandbox security, and full API reference. Use when building chat applications that embed MCP App UIs, or when you need in-depth MCP Apps architecture/API knowledge without cloning ext-apps.
---

# MCP Apps Host Development & Reference

Build applications that embed MCP App UIs using AppBridge, with comprehensive reference documentation.

**This is an experimental extension.** MCP Apps enables servers to deliver interactive HTML UIs that run in sandboxed iframes, allowing rich visual interfaces while maintaining security.

---

## When to Use This Skill

**Use this skill when:**
- **Building a host application** that embeds MCP App UIs (chat app, IDE plugin, agent interface)
- **Implementing AppBridge** for iframe communication, tool routing, and security
- **Developing multi-server hosts** with tool aggregation and UI routing
- **Learning MCP Apps architecture** without cloning the ext-apps repository
- **Referencing the complete API** for App, AppBridge, and React hooks

**For creating MCP App servers or UIs:** Use the official `create-mcp-app` skill first - it provides guided project scaffolding. This skill's server/app snippets are supplementary reference material.

> Install official skills via: `/plugin marketplace add modelcontextprotocol/ext-apps` or `npx skills add modelcontextprotocol/ext-apps`

---

> **React Hosts:** For React-based host applications, consider [`@mcp-ui/client`](https://www.npmjs.com/package/@mcp-ui/client) which provides ready-made React components for rendering MCP Apps. See [mcpui.dev documentation](https://mcpui.dev/guide/mcp-apps#host-side-rendering-client-sdk). This skill focuses on lower-level AppBridge integration for custom hosts.

> **Tip: Stay up to date!** MCP Apps is under active development. Before starting, check the [ext-apps repository](https://github.com/modelcontextprotocol/ext-apps) for:
> - [Open Pull Requests](https://github.com/modelcontextprotocol/ext-apps/pulls) - upcoming changes
> - [Issues](https://github.com/modelcontextprotocol/ext-apps/issues) - known bugs and feature requests
> - [Recent Commits](https://github.com/modelcontextprotocol/ext-apps/commits/main) - latest changes
> - [Releases](https://github.com/modelcontextprotocol/ext-apps/releases) - version history

## How It Works

1. **Browse** the snippet catalog below or in `snippets/`
2. **Identify** your role: server developer, app developer, or host integrator
3. **Copy** the snippets you need into your project
4. **Customize** the copied code for your use case

---

## Quick Start Decision Trees

### Why Are You Here?

```
Building a HOST that embeds MCP App UIs?  [PRIMARY USE CASE]
  -> Start with HOST snippets
      - host-full-integration: Complete end-to-end flow (RECOMMENDED START)
      - host-multi-server: Connect to multiple servers with UI routing
      - sandbox-proxy: Required double-iframe security
      - app-bridge-basic: Just the AppBridge setup
      - app-bridge-handlers: Full handlers implementation

Need MCP Apps REFERENCE documentation?
  -> Browse reference files
      - reference/mcp_apps_api_reference.md: Complete API docs (App, AppBridge, React hooks)
      - reference/mcp_apps_architecture.md: Architecture, security, common pitfalls

Learning how MCP Apps work internally?
  -> Review snippets as educational examples
      - Server snippets: How tools link to UIs
      - App snippets: How UIs receive tool results and communicate with hosts
      - Scaffold: Complete runnable example

Creating an MCP App server or UI?
  -> Consider official create-mcp-app skill first
      Official skill provides guided scaffolding with framework selection.
      Use snippets below as supplementary reference:

      SERVER snippets (reference):
      - tool-with-ui: Register tool with associated HTML UI
      - tool-with-structured: Return structured content
      - resource-with-csp: Add Content Security Policy
      - server-with-private-tools: Hide tools from model

      APP snippets (reference):
      - app-vanilla-basic: Simple App class setup (vanilla JS)
      - app-vanilla-full: Full lifecycle handlers (vanilla JS)
      - app-react-basic: React hooks integration
      - app-react-with-styles: React with host styling
      - tool-calling: Call back to server tools
      - app-with-display-mode: Request fullscreen/pip
      - app-with-model-context: Update model context
```

### Which App Framework Should I Use?

```
Minimal dependencies, simple UI?
  -> Use Vanilla JS snippets
      - app-vanilla-basic for getting started
      - app-vanilla-full for full control

React-based UI with state management?
  -> Use React snippets
      - app-react-basic for hooks integration
      - app-react-with-styles for host styling
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
- **Host Context**: Theme, locale, styles, and safe area information from the host
- **Display Modes**: Inline, fullscreen, or picture-in-picture display options

### 1.3 Browse Available Snippets

**Host Snippets (Primary)**

| Snippet | Description | Best For |
|---------|-------------|----------|
| `host-full-integration` | Complete host flow | **START HERE** for hosts |
| `host-multi-server` | Multi-server host | Multiple server routing |
| `app-bridge-basic` | Basic host embedding | Simple AppBridge setup |
| `app-bridge-handlers` | Full AppBridge handlers | Custom handler logic |
| `sandbox-proxy` | Sandbox proxy HTML | Required for security |

**Server & App Snippets (Reference)**

| Snippet | Description | Best For |
|---------|-------------|----------|
| `scaffold-vanilla-server` | Complete starter project | Learning - copy & run |
| `tool-with-ui` | Tool with UI resource registration | Server pattern reference |
| `tool-with-structured` | Tool returning structuredContent | Rich data responses |
| `resource-with-csp` | UI resource with CSP metadata | Security-conscious apps |
| `server-with-private-tools` | Tools hidden from model | UI-only actions |
| `app-vanilla-basic` | Basic App class (vanilla JS) | App pattern reference |
| `app-vanilla-full` | Full lifecycle handlers | Production app patterns |
| `app-react-basic` | React hooks integration | React app reference |
| `app-react-with-styles` | React with host styling | Themed React apps |
| `tool-calling` | Call MCP tools from app | Interactive UI patterns |
| `app-with-display-mode` | Request fullscreen/pip | Display mode patterns |
| `app-with-model-context` | Update model context | State persistence patterns |

---

## Phase 2: Implement

### 2.1 Host-Side: Embed MCP Apps (Primary)

```bash
npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk
```

**Option A: Custom host with AppBridge** (this skill's focus)

Copy the `host-full-integration` snippet for the complete flow:
1. Connect MCP client to server (see **mcp-client-ts** skill)
2. Create AppBridge with the connected client
3. Set up sandbox proxy iframe (use `sandbox-proxy` snippet)
4. Register handlers before connecting
5. Load UI resource and initialize app

**Option B: React host with @mcp-ui/client**

For React-based hosts, consider using the MCP-UI client library:
```bash
npm install @mcp-ui/client
```
See [mcpui.dev](https://mcpui.dev/guide/mcp-apps#host-side-rendering-client-sdk) for React component documentation.

> **Critical:** The App initiates `ui/initialize`, the Host responds! If building without AppBridge SDK, you must handle the request/response correctly. See "Common Pitfalls" in the Architecture reference.

> **See also:** For MCP client basics (connecting to servers, calling tools), refer to the **mcp-client-ts** skill.

### 2.2 Server-Side: Register Tool with UI (Reference)

```bash
npm install @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps zod
```

Copy the `tool-with-ui` snippet and customize:
1. Define your tool's input schema
2. Create the UI resource HTML content
3. Link tool to UI via `ui://` URI and `_meta.ui.resourceUri`

For tools that should only be callable by the UI (not the model), use `server-with-private-tools`:
```typescript
_meta: { ui: { resourceUri: "ui://...", visibility: ["app"] } }
```

> **See also:** For MCP server basics (transports, tool registration patterns), refer to the **mcp-server-ts** skill.

### 2.3 App-Side: Build the UI (Reference)

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
4. Handle `ontoolcancelled` for cancellation
5. Handle `onhostcontextchanged` for theme/style changes
6. Call tools via `app.callServerTool()`

### 2.4 Host Context & Styling

Apps can access host context for theme, styles, and safe areas:

```typescript
const context = app.getHostContext();
// {
//   theme: "light" | "dark",
//   locale: "en-US",
//   styles: { variables: { ... }, css: { fonts: "..." } },
//   safeAreaInsets: { top, right, bottom, left },
//   availableDisplayModes: ["inline", "fullscreen", "pip"]
// }
```

**React:** Use `useHostStyleVariables()` and `useHostFonts()` hooks to automatically apply host styles.

### 2.5 Display Modes

Apps can request different display modes:

```typescript
// Check if fullscreen is available
if (context?.availableDisplayModes?.includes("fullscreen")) {
  await app.requestDisplayMode({ mode: "fullscreen" });
}
```

### 2.6 Model Context Updates

Apps can update the model's context with state information:

```typescript
await app.updateModelContext({
  content: [{ type: "text", text: "User selected 3 items" }],
  structuredContent: { items: 3, total: 150.00 }
});
```

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
- [ ] `ontoolcancelled` handles cancellation gracefully
- [ ] `onhostcontextchanged` responds to theme changes
- [ ] `callServerTool()` successfully calls server
- [ ] CSP is properly declared (if using)

### 3.4 Common Gotchas

**1. Always describe your UI in `content`:**
The model doesn't see the visual UI - only the tool result content. Always include a text description of what was rendered:

```typescript
return {
  content: [{ type: "text", text: "Displayed weather widget showing 72°F, sunny conditions" }],
  structuredContent: { temp: 72, condition: "sunny" }
};
```

**2. Data flow to model context:**
- `content` and `structuredContent` → sent to model context
- `_meta` → NOT sent to model (only for host/UI metadata)
- Don't put large base64 data in `structuredContent` - use `content` with resource references

**3. Check for UI support before registering (coming soon):**
Once [PR #313](https://github.com/modelcontextprotocol/ext-apps/pull/313) merges, use `hasUiSupport()` to conditionally register UI tools:

```typescript
server.oninitialized = ({ clientCapabilities }) => {
  if (hasUiSupport(clientCapabilities)) {
    registerAppTool(server, "weather", { /* ... */ }, handler);
  }
};
```

---

## Available Snippets Catalog

### Host (Embedding Apps) - Primary

| Name | Description |
|------|-------------|
| `host-full-integration` | **START HERE** - Complete flow: MCP client + tool call + UI detection + AppBridge |
| `host-multi-server` | Multi-server host with tool aggregation and UI routing |
| `app-bridge-basic` | Basic AppBridge setup with PostMessageTransport |
| `app-bridge-handlers` | Full handlers: `onmessage`, `onopenlink`, `onloggingmessage`, `onsizechange`, `onupdatemodelcontext` |
| `sandbox-proxy` | Required sandbox proxy HTML for double-iframe security |

### Server (Reference)

| Name | Description |
|------|-------------|
| `tool-with-ui` | Register MCP tool with UI resource using `registerAppTool` and `registerAppResource` |
| `tool-with-structured` | Tool returning `structuredContent` for typed responses |
| `resource-with-csp` | UI resource with Content Security Policy metadata |
| `server-with-private-tools` | Tools with `visibility: ["app"]` hidden from model |

### App (Reference)

| Name | Description |
|------|-------------|
| `app-vanilla-basic` | Basic App class with `ontoolresult` handler (vanilla JS) |
| `app-vanilla-full` | Full lifecycle: all handlers including `ontoolcancelled`, `onhostcontextchanged` |
| `app-react-basic` | React component with `useApp` hook |
| `app-react-with-styles` | React with `useHostStyleVariables` and `useHostFonts` |
| `tool-calling` | Examples of calling MCP tools from app UI |
| `app-with-display-mode` | Request fullscreen/pip display modes |
| `app-with-model-context` | Update model context with app state |

### Scaffold (Learning)

| Name | Description |
|------|-------------|
| `scaffold-vanilla-server` | Complete MCP App server with vanilla JS UI - copy entire directory and run |

**Quick Start with Scaffold:**

```bash
# Copy the scaffold to your project
cp -r snippets/scaffold/vanilla-server ./my-mcp-app

# Install and run
cd my-mcp-app
npm install
npm run dev
```

Server runs at `http://localhost:3102/mcp`. Test with the [basic-host example](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host).

---

## Reference Files

For deeper guidance, load these reference documents:

- [MCP Apps Architecture](./reference/mcp_apps_architecture.md) - Component overview, data flow, security, **common pitfalls**, **open PRs/issues**
- [MCP Apps API Reference](./reference/mcp_apps_api_reference.md) - Full API documentation

> **Important:** Read the "Common Pitfalls" section in the Architecture doc before implementing a host. Key issues include srcdoc iframe origins, protocol direction, message sequencing, and handler overwrite bugs.

---

## SDK Packages

| Package | Import Path | Purpose |
|---------|-------------|---------|
| Main SDK | `@modelcontextprotocol/ext-apps` | App class, types, style utilities |
| Server helpers | `@modelcontextprotocol/ext-apps/server` | `registerAppTool`, `registerAppResource` |
| React | `@modelcontextprotocol/ext-apps/react` | `useApp`, `useHostStyleVariables`, `useHostFonts`, `useHostStyles` |
| App Bridge | `@modelcontextprotocol/ext-apps/app-bridge` | AppBridge for hosts |

---

## External Resources

- [MCP Apps SDK Repository](https://github.com/modelcontextprotocol/ext-apps)
- [MCP Apps Overview](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/overview.md) - Architecture with diagrams
- [Quickstart Guide](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/quickstart.md) - Type-checked step-by-step intro
- [Patterns Guide](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/patterns.md) - Common implementation patterns
- [Migration Guide](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/migrate_from_openai_apps.md) - Convert from OpenAI Apps SDK
- [API Documentation](https://modelcontextprotocol.github.io/ext-apps/api/)
- [SEP-1865 Specification](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
