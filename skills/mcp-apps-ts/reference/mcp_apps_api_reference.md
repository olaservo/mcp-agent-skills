# MCP Apps API Reference

Complete API reference for the MCP Apps SDK (`@modelcontextprotocol/ext-apps`).

## Package Exports

| Import Path | Purpose |
|-------------|---------|
| `@modelcontextprotocol/ext-apps` | Main SDK: `App` class |
| `@modelcontextprotocol/ext-apps/server` | Server helpers and constants |
| `@modelcontextprotocol/ext-apps/react` | React hooks |
| `@modelcontextprotocol/ext-apps/app-bridge` | Host integration |

---

## Server Helpers

### `registerAppTool()`

Registers an MCP tool with UI metadata.

```typescript
import { registerAppTool, RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps/server";

registerAppTool(
  server: McpServer,
  name: string,
  options: {
    title?: string;
    description: string;
    inputSchema: object;
    outputSchema?: object;
    _meta?: {
      [RESOURCE_URI_META_KEY]: string;  // ui:// URI
    };
  },
  handler: () => Promise<CallToolResult>
);
```

### `registerAppResource()`

Registers a UI resource.

```typescript
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

registerAppResource(
  server: McpServer,
  name: string,              // Resource name
  uri: string,               // ui:// URI
  options: {
    mimeType: typeof RESOURCE_MIME_TYPE;  // "text/html;profile=mcp-app"
  },
  handler: () => Promise<ReadResourceResult>
);
```

### Constants

```typescript
import {
  RESOURCE_URI_META_KEY,  // Key for _meta.ui.resourceUri
  RESOURCE_MIME_TYPE      // "text/html;profile=mcp-app"
} from "@modelcontextprotocol/ext-apps/server";
```

---

## App Class

The main class for building MCP App UIs.

### Constructor

```typescript
import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({
  name: string;     // App name
  version: string;  // App version (semver)
});
```

### Methods

#### `connect()`

Connects to the host. Must be called after registering handlers.

```typescript
app.connect();
// or with explicit transport:
import { PostMessageTransport } from "@modelcontextprotocol/ext-apps";
app.connect(new PostMessageTransport(window.parent));
```

#### `callServerTool()`

Calls an MCP tool on the server.

```typescript
const result = await app.callServerTool({
  name: string;                    // Tool name
  arguments: Record<string, any>;  // Tool arguments
});

// Returns: CallToolResult
// {
//   content: Array<{ type: "text", text: string } | ...>,
//   structuredContent?: any,
//   isError?: boolean
// }
```

#### `sendMessage()`

Sends a message to the host for display in chat.

```typescript
const response = await app.sendMessage(
  {
    role: "user" | "assistant";
    content: Array<{ type: "text"; text: string }>;
  },
  { signal?: AbortSignal }  // Optional abort signal
);

// Returns: { isError?: boolean }
```

#### `sendLog()`

Sends a log entry to the host.

```typescript
await app.sendLog({
  level: "debug" | "info" | "warning" | "error";
  data: string;
});
```

#### `openLink()`

Requests the host to open a URL.

```typescript
const response = await app.openLink({
  url: string;
});

// Returns: { isError?: boolean }
```

### Event Handlers

Register handlers BEFORE calling `connect()`.

#### `ontoolinput`

Called when tool input arguments are received.

```typescript
app.ontoolinput = (params: { arguments: Record<string, any> }) => {
  console.log("Tool input:", params.arguments);
};
```

#### `ontoolresult`

Called when tool execution result is received.

```typescript
app.ontoolresult = (result: CallToolResult) => {
  const text = result.content?.find(c => c.type === "text")?.text;
  const structured = result.structuredContent;
  // Update UI with result
};
```

#### `onteardown`

Called when the app is being destroyed. Return a promise for async cleanup.

```typescript
app.onteardown = async () => {
  // Cleanup resources
  return {};
};
```

#### `onerror`

Called on errors.

```typescript
app.onerror = (error: Error) => {
  console.error("App error:", error);
};
```

---

## React Hooks

### `useApp()`

React hook for managing App lifecycle.

```typescript
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function MyComponent() {
  const { app, error } = useApp({
    appInfo: {
      name: string;
      version: string;
    },
    capabilities?: {},
    onAppCreated?: (app: App) => void;  // Register handlers here
  });

  if (error) return <div>Error: {error.message}</div>;
  if (!app) return <div>Connecting...</div>;

  return <MyAppUI app={app} />;
}
```

**Example with handlers:**

```typescript
const { app, error } = useApp({
  appInfo: { name: "My App", version: "1.0.0" },
  onAppCreated: (app) => {
    app.ontoolresult = async (result) => {
      setResult(result);
    };
    app.ontoolinput = async (input) => {
      console.log("Input:", input);
    };
    app.onerror = console.error;
  },
});
```

---

## AppBridge Class (Host)

For building hosts that embed MCP Apps.

### Constructor

```typescript
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const appBridge = new AppBridge(
  mcpClient: Client,           // MCP client connected to server
  implementation: {
    name: string;
    version: string;
  },
  options?: {
    openLinks?: {};                    // Enable link opening
    serverTools?: ToolsCapability;     // Server tool capabilities
    serverResources?: ResourcesCapability;
  }
);
```

### Methods

#### `connect()`

Connects to an app iframe.

```typescript
await appBridge.connect(
  new PostMessageTransport(iframe.contentWindow, iframe.contentWindow)
);
```

#### `sendSandboxResourceReady()`

Sends the HTML content to the sandbox proxy for loading.

```typescript
await appBridge.sendSandboxResourceReady({
  html: string;
  csp?: {
    connectDomains?: string[];
    resourceDomains?: string[];
  };
});
```

#### `sendToolInput()`

Sends tool input to the app.

```typescript
appBridge.sendToolInput({
  arguments: Record<string, any>;
});
```

#### `sendToolResult()`

Sends tool execution result to the app.

```typescript
appBridge.sendToolResult(result: CallToolResult);
```

#### `sendToolCancelled()`

Notifies app that tool execution was cancelled.

```typescript
appBridge.sendToolCancelled({
  reason: string;
});
```

### Event Handlers

Register handlers BEFORE calling `connect()`.

#### `oninitialized`

Called when the app is ready.

```typescript
appBridge.oninitialized = () => {
  console.log("App initialized");
};
```

#### `onmessage`

Called when app sends a message.

```typescript
appBridge.onmessage = async (params, extra) => {
  console.log("Message from app:", params);
  return {};  // Accept message
};
```

#### `onopenlink`

Called when app requests to open a URL.

```typescript
appBridge.onopenlink = async (params, extra) => {
  window.open(params.url, "_blank", "noopener,noreferrer");
  return {};  // Accept request
};
```

#### `onloggingmessage`

Called when app sends a log entry.

```typescript
appBridge.onloggingmessage = (params) => {
  console.log(`[${params.level}] ${params.data}`);
};
```

#### `onsizechange`

Called when app requests a size change.

```typescript
appBridge.onsizechange = async ({ width, height }) => {
  if (width) iframe.style.width = `${width}px`;
  if (height) iframe.style.height = `${height}px`;
};
```

---

## Helper Functions

### `getToolUiResourceUri()`

Extracts the UI resource URI from a tool definition.

```typescript
import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";

const uri = getToolUiResourceUri(tool);
// Returns: string | undefined
```

---

## Types

### CallToolResult

```typescript
interface CallToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource"; resource: { uri: string; text?: string; blob?: string } }
  >;
  structuredContent?: any;
  isError?: boolean;
}
```

### ReadResourceResult

```typescript
interface ReadResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
    _meta?: {
      ui?: {
        csp?: {
          connectDomains?: string[];
          resourceDomains?: string[];
        };
      };
    };
  }>;
}
```
