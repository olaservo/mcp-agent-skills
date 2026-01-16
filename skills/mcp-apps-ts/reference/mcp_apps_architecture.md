# MCP Apps Architecture

MCP Apps (SEP-1865) is an experimental extension to the Model Context Protocol that enables servers to deliver interactive HTML UIs to client applications.

> **Active Development:** This SDK is under rapid development. Before starting, check the [ext-apps repository](https://github.com/modelcontextprotocol/ext-apps) for recent changes. See the [Open PRs & Issues](#open-prs--issues-to-watch) section below.

## Core Pattern: Tool + UI Resource

MCP Apps uses a **two-part registration** pattern:

1. **Tool**: A standard MCP tool that performs server-side logic
2. **UI Resource**: An HTML resource that renders the tool's results interactively

These are linked together via the tool's `_meta` field using `_meta.ui.resourceUri`.

```
+-------------------------------------------------------------+
|                         MCP SERVER                          |
|                                                             |
|  +----------------------+    +----------------------+       |
|  |   Tool: "get-time"   |--->|  Resource: ui://...  |       |
|  |   _meta.ui.resourceUri    |  mimeType: mcp-app   |       |
|  +----------------------+    +----------------------+       |
|                                                             |
+-------------------------------------------------------------+
```

## Three-Component Architecture

### 1. Server (MCP Server)

The server:
- Registers tools with UI metadata linking to `ui://` resources
- Registers UI resources returning HTML content with `text/html;profile=mcp-app` MIME type
- Processes tool calls and returns results

**Key imports:**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY
} from "@modelcontextprotocol/ext-apps/server";
```

### 2. App (HTML UI in iframe)

The app:
- Runs inside a sandboxed iframe
- Communicates with the host via postMessage
- Receives tool inputs and results
- Can call back to server tools

**Key imports:**
```typescript
import { App } from "@modelcontextprotocol/ext-apps";
// or for React:
import { useApp } from "@modelcontextprotocol/ext-apps/react";
```

### 3. Host (Chat Application)

The host:
- Embeds MCP Apps in sandboxed iframes
- Routes communication between app and server
- Enforces security policies (CSP, sandboxing)

**Key imports:**
```typescript
import {
  AppBridge,
  PostMessageTransport
} from "@modelcontextprotocol/ext-apps/app-bridge";
```

## The `ui://` URI Scheme

MCP Apps uses a custom `ui://` URI scheme to reference UI resources:

```
ui://tool-name/app.html
```

- **Protocol**: `ui://` (not `http://` or `file://`)
- **Path**: Typically includes the tool name for organization
- **File**: Usually ends with `.html`

This URI is used in:
1. Tool's `_meta.ui.resourceUri` to link to the UI
2. Resource registration to identify the resource
3. Host requests to fetch the UI HTML

## Communication Flow

```
+----------+    +----------+    +----------+    +----------+
|   User   |--->|   Host   |--->|   App    |<-->|  Server  |
+----------+    +----------+    +----------+    +----------+
     |               |               |               |
     |  1. Call tool |               |               |
     |-------------->| 2. Call tool  |               |
     |               |------------------------------>|
     |               |               |  3. Result    |
     |               |<------------------------------|
     |               |  4. Load UI   |               |
     |               |<------------->|               |
     |               |  5. Send result               |
     |               |-------------->|               |
     |               |  6. Render UI |               |
     |<--------------|<--------------|               |
     |               |               |               |
     |               |  7. User interaction          |
     |               |<--------------|               |
     |               |  8. callServerTool            |
     |               |-------------->|-------------->|
     |               |               |  9. Result    |
     |               |               |<--------------|
```

## Host Context

The host provides context to the app during initialization and can send updates via `onhostcontextchanged`.

### Available Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `theme` | `"light" \| "dark"` | Current host theme |
| `locale` | `string` | User's locale (e.g., "en-US") |
| `toolInfo` | `object` | Current tool and arguments |
| `styles.variables` | `Record<string, string>` | CSS custom properties from host |
| `styles.css.fonts` | `string` | Font CSS (@font-face, @import) |
| `safeAreaInsets` | `object` | Safe area padding (top, right, bottom, left) |
| `availableDisplayModes` | `string[]` | Supported display modes |

### Using Host Context

```typescript
// Get context after connection
const context = app.getHostContext();

// Apply theme
if (context?.theme === "dark") {
  document.body.classList.add("dark-theme");
}

// Apply safe area insets
if (context?.safeAreaInsets) {
  document.body.style.paddingTop = `${context.safeAreaInsets.top}px`;
}

// Listen for changes
app.onhostcontextchanged = (params) => {
  if (params.theme) {
    document.body.classList.toggle("dark-theme", params.theme === "dark");
  }
};
```

## Display Modes

Apps can request different display modes for immersive experiences.

### Available Modes

| Mode | Description |
|------|-------------|
| `inline` | Default embedded view in chat |
| `fullscreen` | Full-screen overlay |
| `pip` | Picture-in-picture floating window |

### Requesting Display Mode

```typescript
const context = app.getHostContext();

// Check if fullscreen is available
if (context?.availableDisplayModes?.includes("fullscreen")) {
  // Request fullscreen
  const result = await app.requestDisplayMode({ mode: "fullscreen" });
  console.log("Display mode set to:", result.mode);
}

// Return to inline
await app.requestDisplayMode({ mode: "inline" });
```

## Model Context Updates

Apps can update the host's model context with app state, which will be available to the model in future reasoning.

```typescript
// Update with text content
await app.updateModelContext({
  content: [{ type: "text", text: "User selected 3 items totaling $150.00" }]
});

// Update with structured content
await app.updateModelContext({
  structuredContent: {
    selectedItems: 3,
    total: 150.00,
    currency: "USD"
  }
});
```

The host will typically defer sending the context to the model until the next user message. Each call overwrites any previous context update.

## Security Model

### Double-Iframe Sandboxing

MCP Apps uses a two-layer iframe structure:

```
+---------------------------------------------+
|                    HOST                     |
|  +-----------------------------------------+|
|  |         OUTER IFRAME (Sandbox Proxy)    ||
|  |    sandbox="allow-scripts allow-same-origin"
|  |  +-------------------------------------+||
|  |  |         INNER IFRAME (App)          |||
|  |  |    sandbox="allow-scripts"          |||
|  |  |    [Your MCP App HTML]              |||
|  |  +-------------------------------------+||
|  +-----------------------------------------+|
+---------------------------------------------+
```

**Outer iframe**:
- Has `allow-scripts` and `allow-same-origin`
- Acts as a message relay/proxy
- Validates and sanitizes communication

**Inner iframe**:
- Has `allow-scripts` only (no `allow-same-origin`)
- Cannot access host cookies or DOM
- Runs the actual app HTML

### Content Security Policy (CSP)

Servers can declare CSP requirements via resource metadata:

```typescript
_meta: {
  ui: {
    csp: {
      connectDomains: ["api.example.com"],  // Allowed for fetch/XHR
      resourceDomains: ["cdn.example.com"]  // Allowed for images, scripts
    }
  }
}
```

**Default CSP** (when no domains specified):
```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'
```

This blocks all external network access by default.

## Tool Visibility

Tools can be configured for different audiences:

```typescript
// Default: visible to both model and app
_meta: { ui: { resourceUri: "ui://cart/widget.html" } }

// App-only: hidden from model, only callable by the UI
_meta: { ui: { resourceUri: "ui://cart/widget.html", visibility: ["app"] } }
```

Use `visibility: ["app"]` for actions that should only be triggered by user interaction in the UI, not by the model.

## Resource MIME Type

MCP App resources must use the specific MIME type:

```
text/html;profile=mcp-app
```

This is available as the constant `RESOURCE_MIME_TYPE` from the SDK:

```typescript
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
// Value: "text/html;profile=mcp-app"
```

## Lifecycle Events

### App Lifecycle

> **IMPORTANT**: The App initiates the handshake, not the Host!

1. **Initialize**: App sends `ui/initialize` REQUEST to Host
2. **Initialize Response**: Host RESPONDS with capabilities and context
3. **Initialized**: App sends `ui/notifications/initialized` notification
4. **Tool Input**: Host sends `ui/toolInput` with arguments
5. **Tool Result**: Host sends `ui/toolResult` with execution result
6. **Teardown**: Host requests cleanup via `ui/teardown`

This follows the MCP pattern where the "client-like" component (App) initiates.

### App Event Handlers

```typescript
app.ontoolinput       // Receives complete tool input arguments
app.ontoolinputpartial // Receives streaming partial tool arguments
app.ontoolresult      // Receives tool execution result
app.ontoolcancelled   // Handles tool cancellation
app.onhostcontextchanged // Handles host context changes
app.onteardown        // Cleanup before unmounting
app.onerror           // Handle errors
```

### AppBridge Event Handlers

```typescript
appBridge.oninitialized    // App is ready
appBridge.onmessage        // App sent a message
appBridge.onopenlink       // App requested to open URL
appBridge.onloggingmessage // App sent log entry
appBridge.onsizechange     // App requested size change
```

## Common Pitfalls

### 1. srcdoc iframes have "null" origin

When using `srcdoc` to load HTML into the inner iframe, the iframe's origin becomes the string `"null"` (not the parent's origin). The sandbox proxy must accept this:

```javascript
// WRONG - will reject messages from srcdoc iframes
if (event.origin !== OWN_ORIGIN) { return; }

// CORRECT - accept both normal origin and "null" for srcdoc
if (event.origin !== OWN_ORIGIN && event.origin !== "null") { return; }
```

### 2. Protocol direction: App initiates, Host responds

The `ui/initialize` handshake follows MCP's client-server pattern:
- **App** (client-like) SENDS `ui/initialize` request
- **Host** (server-like) RESPONDS with capabilities

If you're building a host without the AppBridge SDK, you must RESPOND to `ui/initialize`, not send it:

```javascript
// In your message handler:
if (data.method === 'ui/initialize' && data.id) {
  // RESPOND to the request
  sendToApp({
    jsonrpc: '2.0',
    id: data.id,  // Use the request ID!
    result: {
      protocolVersion: '2025-01-01',
      hostCapabilities: { tools: {}, resources: {} },
      hostInfo: { name: 'MyHost', version: '1.0.0' },
    },
  });
}
```

### 3. Tool calls use standard MCP method names

When an App calls `app.callServerTool()`, it sends a `tools/call` request (standard MCP method), not a custom method:

```javascript
// Handle tool calls from app
if (data.method === 'tools/call' && data.id) {
  const { name, arguments: args } = data.params;
  // Call the MCP server and return result...
}
```

### 4. Message sequence matters

The correct sequence after sandbox-proxy-ready:

1. Host sends `sandbox-resource-ready` (HTML loads into inner iframe)
2. App loads and calls `app.connect()` which sends `ui/initialize`
3. Host responds to `ui/initialize`
4. App sends `ui/notifications/initialized`
5. Host sends `ui/toolInput` and `ui/toolResult`

If you send `ui/initialize` before the HTML is loaded, the message is lost.

### 5. Host code requires bundling for browsers

The MCP SDK (`@modelcontextprotocol/sdk`) contains Node.js-specific code that doesn't work directly in browsers. Loading via CDN (e.g., esm.sh) will fail with errors like `e.custom is not a function`.

**Solution:** Use Vite or another bundler for host code:

```typescript
// vite.config.ts for host
import { defineConfig } from "vite";

export default defineConfig({
  root: "host",
  server: { port: 8080 },
});
```

Then serve the host via Vite dev server instead of static file serving.

### 6. Handlers silently overwrite each other

Setting a handler property multiple times will silently overwrite the previous handler:

```typescript
// WRONG - only the second handler will be called
app.ontoolresult = (result) => console.log("First handler");
app.ontoolresult = (result) => console.log("Second handler");
```

If you need multiple listeners, use `setNotificationHandler()` directly and manage your own dispatch.

### 7. unsafe-eval limitation

Some libraries (e.g., Three.js) require `unsafe-eval` in CSP. This is currently not supported by the default sandbox configuration. Check [issue #199](https://github.com/modelcontextprotocol/ext-apps/issues/199) for updates.

---

## Open PRs & Issues to Watch

The MCP Apps SDK is under active development. Here are key open items that may affect your implementation:

### Open PRs (may change behavior)

| PR | Title | Impact |
|----|-------|--------|
| [#273](https://github.com/modelcontextprotocol/ext-apps/pull/273) | Enforce correct UI resource format | May change `getToolUiResourceUri` behavior |
| [#276](https://github.com/modelcontextprotocol/ext-apps/pull/276) | Add description for ui/initialize lifecycle | Documentation improvement |
| [#215](https://github.com/modelcontextprotocol/ext-apps/pull/215) | Add ui/close-resource request | New feature: UI-initiated termination |
| [#229](https://github.com/modelcontextprotocol/ext-apps/pull/229) | Refactor server start in examples | Example code changes |

### Open Issues (known limitations)

| Issue | Title | Status |
|-------|-------|--------|
| [#225](https://github.com/modelcontextprotocol/ext-apps/issues/225) | Handlers silently overwrite each other | Known bug |
| [#265](https://github.com/modelcontextprotocol/ext-apps/issues/265) | UI Resource Permissions discrepancy | Spec/SDK mismatch |
| [#199](https://github.com/modelcontextprotocol/ext-apps/issues/199) | unsafe-eval requirement for some apps | Limitation |
| [#269](https://github.com/modelcontextprotocol/ext-apps/issues/269) | Duplicate placement of McpUiResourceMeta | Spec clarification needed |

### Recent Changes (v0.4.1)

- Fullscreen support for apps
- PDF viewer with chunked loading
- UV migration for Python examples
- DIST_DIR path fixes for npm execution
- Model context updates with YAML frontmatter

Always check the [ext-apps releases](https://github.com/modelcontextprotocol/ext-apps/releases) for the latest changes.
