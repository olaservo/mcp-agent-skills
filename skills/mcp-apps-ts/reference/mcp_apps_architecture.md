# MCP Apps Architecture

MCP Apps (SEP-1865) is an experimental extension to the Model Context Protocol that enables servers to deliver interactive HTML UIs to client applications.

## Core Pattern: Tool + UI Resource

MCP Apps uses a **two-part registration** pattern:

1. **Tool**: A standard MCP tool that performs server-side logic
2. **UI Resource**: An HTML resource that renders the tool's results interactively

These are linked together via the tool's `_meta` field using `RESOURCE_URI_META_KEY`.

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP SERVER                               │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐           │
│  │   Tool: "get-time"   │───>│  Resource: ui://...  │           │
│  │   _meta.ui.resourceUri    │  mimeType: mcp-app   │           │
│  └──────────────────────┘    └──────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
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
1. Tool's `_meta[RESOURCE_URI_META_KEY]` to link to the UI
2. Resource registration to identify the resource
3. Host requests to fetch the UI HTML

## Communication Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   User   │───>│   Host   │───>│   App    │<──>│  Server  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │  1. Call tool │               │               │
     │──────────────>│ 2. Call tool  │               │
     │               │──────────────────────────────>│
     │               │               │  3. Result    │
     │               │<──────────────────────────────│
     │               │  4. Load UI   │               │
     │               │<─────────────>│               │
     │               │  5. Send result               │
     │               │──────────────>│               │
     │               │  6. Render UI │               │
     │<──────────────│<──────────────│               │
     │               │               │               │
     │               │  7. User interaction          │
     │               │<──────────────│               │
     │               │  8. callServerTool            │
     │               │──────────────>│──────────────>│
     │               │               │  9. Result    │
     │               │               │<──────────────│
```

## Security Model

### Double-Iframe Sandboxing

MCP Apps uses a two-layer iframe structure:

```
┌─────────────────────────────────────────────┐
│                    HOST                      │
│  ┌─────────────────────────────────────────┐ │
│  │         OUTER IFRAME (Sandbox Proxy)     │ │
│  │    sandbox="allow-scripts allow-same-origin"
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │         INNER IFRAME (App)          │ │ │
│  │  │    sandbox="allow-scripts"          │ │ │
│  │  │    [Your MCP App HTML]              │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
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
app.ontoolinput    // Receives tool input arguments
app.ontoolresult   // Receives tool execution result
app.onteardown     // Cleanup before unmounting
app.onerror        // Handle errors
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
