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

1. **Initialize**: Host calls `ui/initialize` with context
2. **Initialized**: App confirms ready via `ui/notifications/initialized`
3. **Tool Input**: Host sends `ui/toolInput` with arguments
4. **Tool Result**: Host sends `ui/toolResult` with execution result
5. **Teardown**: Host requests cleanup via `ui/teardown`

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
