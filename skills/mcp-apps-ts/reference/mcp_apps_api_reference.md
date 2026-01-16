# MCP Apps API Reference

Complete API reference for the MCP Apps SDK (`@modelcontextprotocol/ext-apps`) v0.4.x.

## Package Exports

| Import Path | Purpose |
|-------------|---------|
| `@modelcontextprotocol/ext-apps` | Main SDK: `App` class, types, style utilities |
| `@modelcontextprotocol/ext-apps/server` | Server helpers and constants |
| `@modelcontextprotocol/ext-apps/react` | React hooks |
| `@modelcontextprotocol/ext-apps/app-bridge` | Host integration |

---

## Server Helpers

### `registerAppTool()`

Registers an MCP tool with UI metadata.

```typescript
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

registerAppTool(
  server: McpServer,
  name: string,
  options: {
    title?: string;
    description: string;
    inputSchema?: object;
    outputSchema?: object;
    annotations?: ToolAnnotations;
    _meta: {
      ui: {
        resourceUri: string;         // ui:// URI (required)
        visibility?: ("model" | "app")[];  // Who can see/call this tool
      };
    };
  },
  handler: () => Promise<CallToolResult>
);
```

**Tool Visibility:**

```typescript
// Default: visible to both model and app
_meta: { ui: { resourceUri: "ui://cart/widget.html" } }

// App-only: hidden from model, only callable by the UI
_meta: { ui: { resourceUri: "ui://cart/widget.html", visibility: ["app"] } }

// Explicit both (same as default)
_meta: { ui: { resourceUri: "ui://cart/widget.html", visibility: ["model", "app"] } }
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
    description?: string;
    mimeType?: string;       // Defaults to RESOURCE_MIME_TYPE
    _meta?: {
      ui?: {
        csp?: {
          connectDomains?: string[];   // Allowed for fetch/WebSocket
          resourceDomains?: string[];  // Allowed for scripts/styles/images
        };
      };
    };
  },
  handler: () => Promise<ReadResourceResult>
);
```

### Constants

```typescript
import {
  RESOURCE_URI_META_KEY,  // "ui/resourceUri"
  RESOURCE_MIME_TYPE      // "text/html;profile=mcp-app"
} from "@modelcontextprotocol/ext-apps/server";
```

---

## App Class

The main class for building MCP App UIs.

### Constructor

```typescript
import { App } from "@modelcontextprotocol/ext-apps";

const app = new App(
  appInfo: {
    name: string;     // App name
    version: string;  // App version (semver)
  },
  capabilities?: McpUiAppCapabilities,  // Optional capabilities
  options?: {
    autoResize?: boolean;  // Auto-report size changes (default: true)
  }
);
```

### Methods

#### `connect()`

Connects to the host. Must be called after registering handlers.

```typescript
await app.connect();
// or with explicit transport:
import { PostMessageTransport } from "@modelcontextprotocol/ext-apps";
await app.connect(new PostMessageTransport(window.parent, window.parent));
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

Sends a log entry to the host for debugging/telemetry.

```typescript
await app.sendLog({
  level: "debug" | "info" | "warning" | "error";
  data: string;
  logger?: string;  // Optional logger name
});
```

#### `updateModelContext()`

Updates the host's model context with app state. Unlike `sendLog`, this is intended to be available to the model in future reasoning.

```typescript
await app.updateModelContext({
  content?: Array<{ type: "text"; text: string }>;
  structuredContent?: any;
});
```

The host will typically defer sending the context to the model until the next user message. Each call overwrites any previous context update.

#### `openLink()`

Requests the host to open a URL.

```typescript
const response = await app.openLink({
  url: string;
});

// Returns: { isError?: boolean }
```

#### `requestDisplayMode()`

Requests a change to the display mode (fullscreen, inline, pip).

```typescript
const result = await app.requestDisplayMode({
  mode: "inline" | "fullscreen" | "pip";
});

// Returns: { mode: string }  // The actual mode that was set
```

Check available modes before requesting:

```typescript
const context = app.getHostContext();
if (context?.availableDisplayModes?.includes("fullscreen")) {
  await app.requestDisplayMode({ mode: "fullscreen" });
}
```

#### `sendSizeChanged()`

Manually notifies the host of UI size changes.

```typescript
app.sendSizeChanged({
  width: number;
  height: number;
});
```

Note: If `autoResize` is enabled (default), this is called automatically.

#### `setupSizeChangedNotifications()`

Sets up automatic size change notifications using ResizeObserver. Called automatically by `connect()` if `autoResize` is true.

```typescript
const cleanup = app.setupSizeChangedNotifications();
// Later: cleanup() to disconnect the observer
```

#### `getHostCapabilities()`

Returns the host's capabilities discovered during initialization.

```typescript
const caps = app.getHostCapabilities();
if (caps?.serverTools) {
  console.log("Host supports server tool calls");
}
```

#### `getHostVersion()`

Returns the host's implementation info (name and version).

```typescript
const host = app.getHostVersion();
console.log(`Connected to ${host?.name} v${host?.version}`);
```

#### `getHostContext()`

Returns the host context including theme, locale, styles, and more.

```typescript
const context = app.getHostContext();
// Returns: McpUiHostContext | undefined
```

### Event Handlers

Register handlers BEFORE calling `connect()`.

> **Warning:** Handlers silently overwrite each other. If you need multiple listeners for the same event, use `setNotificationHandler()` directly and manage your own dispatch.

#### `ontoolinput`

Called when complete tool input arguments are received.

```typescript
app.ontoolinput = (params: { arguments: Record<string, any> }) => {
  console.log("Tool input:", params.arguments);
};
```

#### `ontoolinputpartial`

Called as the host streams partial tool arguments during tool call initialization.

```typescript
app.ontoolinputpartial = (params: { arguments: Record<string, any> }) => {
  console.log("Partial args:", params.arguments);
  // Update UI progressively as arguments stream in
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

#### `ontoolcancelled`

Called when tool execution was cancelled.

```typescript
app.ontoolcancelled = (params: { reason?: string }) => {
  console.log("Tool cancelled:", params.reason);
  showCancelledMessage(params.reason ?? "Operation was cancelled");
};
```

#### `onhostcontextchanged`

Called when the host's context changes (theme, locale, styles, etc.).

```typescript
app.onhostcontextchanged = (params: Partial<McpUiHostContext>) => {
  if (params.theme === "dark") {
    document.body.classList.add("dark-theme");
  } else if (params.theme === "light") {
    document.body.classList.remove("dark-theme");
  }
};
```

Note: The params are automatically merged into the internal host context before your callback runs.

#### `onteardown`

Called when the app is being destroyed. Return a promise for async cleanup.

```typescript
app.onteardown = async () => {
  await saveState();
  closeConnections();
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

#### `oncalltool`

Called when the host requests this app to execute a tool (app-provided tools).

```typescript
app.oncalltool = async (params: { name: string; arguments?: any }) => {
  if (params.name === "greet") {
    return { content: [{ type: "text", text: `Hello, ${params.arguments?.name}!` }] };
  }
  throw new Error(`Unknown tool: ${params.name}`);
};
```

#### `onlisttools`

Called when the host requests a list of tools this app provides.

```typescript
app.onlisttools = async () => {
  return { tools: ["greet", "calculate", "convert"] };
};
```

---

## React Hooks

### `useApp()`

React hook for managing App lifecycle.

```typescript
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function MyComponent() {
  const { app, isConnected, error } = useApp({
    appInfo: {
      name: string;
      version: string;
    },
    capabilities: McpUiAppCapabilities;
    onAppCreated?: (app: App) => void;  // Register handlers here
  });

  if (error) return <div>Error: {error.message}</div>;
  if (!isConnected) return <div>Connecting...</div>;

  return <MyAppUI app={app} />;
}
```

**Example with all handlers:**

```typescript
const { app, isConnected, error } = useApp({
  appInfo: { name: "My App", version: "1.0.0" },
  capabilities: {},
  onAppCreated: (app) => {
    app.ontoolresult = (result) => setResult(result);
    app.ontoolinput = (input) => console.log("Input:", input);
    app.ontoolcancelled = (params) => console.log("Cancelled:", params.reason);
    app.onhostcontextchanged = (params) => setHostContext(prev => ({ ...prev, ...params }));
    app.onerror = console.error;
  },
});
```

### `useHostStyleVariables()`

Applies host style variables and theme as CSS custom properties.

```typescript
import { useHostStyleVariables } from "@modelcontextprotocol/ext-apps/react";

function MyApp() {
  const { app } = useApp({ appInfo, capabilities: {} });

  // Apply host styles - pass initial context for immediate application
  useHostStyleVariables(app, app?.getHostContext());

  return (
    <div style={{ background: 'var(--color-background-primary)' }}>
      Hello!
    </div>
  );
}
```

### `useHostFonts()`

Applies host fonts from CSS.

```typescript
import { useHostFonts } from "@modelcontextprotocol/ext-apps/react";

function MyApp() {
  const { app } = useApp({ appInfo, capabilities: {} });

  useHostFonts(app, app?.getHostContext());

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      Hello!
    </div>
  );
}
```

### `useHostStyles()`

Convenience hook that combines `useHostStyleVariables` and `useHostFonts`.

```typescript
import { useHostStyles } from "@modelcontextprotocol/ext-apps/react";

function MyApp() {
  const { app } = useApp({ appInfo, capabilities: {} });
  useHostStyles(app, app?.getHostContext());

  return <div style={{ background: 'var(--color-background-primary)' }}>...</div>;
}
```

### `useDocumentTheme()`

React hook for reactive document theme.

```typescript
import { useDocumentTheme } from "@modelcontextprotocol/ext-apps/react";

function MyApp() {
  const theme = useDocumentTheme(); // "light" | "dark"

  return <div className={theme === "dark" ? "dark-mode" : ""}>...</div>;
}
```

### `useAutoResize()`

Manual auto-resize control. Rarely needed since `autoResize` is enabled by default.

```typescript
import { useAutoResize } from "@modelcontextprotocol/ext-apps/react";

function MyApp() {
  const { app } = useApp({ appInfo, capabilities: {} });

  // If you created App with autoResize: false, use this to enable it manually
  useAutoResize(app);

  return <div>...</div>;
}
```

---

## Style Utilities

### `applyHostStyleVariables()`

Applies host style variables to the document.

```typescript
import { applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";

applyHostStyleVariables(context.styles?.variables);
```

### `applyHostFonts()`

Applies host fonts CSS to the document.

```typescript
import { applyHostFonts } from "@modelcontextprotocol/ext-apps";

applyHostFonts(context.styles?.css?.fonts);
```

### `applyDocumentTheme()`

Sets the document theme.

```typescript
import { applyDocumentTheme } from "@modelcontextprotocol/ext-apps";

applyDocumentTheme("dark"); // or "light"
```

### `getDocumentTheme()`

Gets the current document theme.

```typescript
import { getDocumentTheme } from "@modelcontextprotocol/ext-apps";

const theme = getDocumentTheme(); // "light" | "dark"
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

#### `sendToolInputPartial()`

Sends streaming partial tool arguments to the app.

```typescript
appBridge.sendToolInputPartial({
  arguments: Record<string, any>;  // Partial/incomplete arguments
});
```

#### `setHostContext()`

Updates the host context and notifies the app of changes. Only sends notification for changed fields.

```typescript
appBridge.setHostContext({
  theme: "dark",
  availableDisplayModes: ["inline", "fullscreen"],
});
```

#### `sendHostContextChange()`

Low-level method to send context changes directly. Use `setHostContext()` for automatic change detection.

```typescript
appBridge.sendHostContextChange({
  theme: "dark",
});
```

#### `teardownResource()`

Requests graceful shutdown of the app. Call before unmounting iframe.

```typescript
await appBridge.teardownResource({});
// Safe to remove iframe after this resolves
```

#### `getAppCapabilities()`

Returns the app's capabilities discovered during initialization.

```typescript
const caps = appBridge.getAppCapabilities();
if (caps?.tools) {
  console.log("App provides tools");
}
```

#### `getAppVersion()`

Returns the app's implementation info (name and version).

```typescript
const appInfo = appBridge.getAppVersion();
console.log(`App: ${appInfo?.name} v${appInfo?.version}`);
```

#### `getCapabilities()`

Returns the host capabilities passed to the constructor.

```typescript
const hostCaps = appBridge.getCapabilities();
```

#### `sendToolListChanged()`

Notifies app that the server's tool list has changed.

```typescript
appBridge.sendToolListChanged();
```

#### `sendResourceListChanged()`

Notifies app that the server's resource list has changed.

```typescript
appBridge.sendResourceListChanged();
```

#### `sendPromptListChanged()`

Notifies app that the server's prompt list has changed.

```typescript
appBridge.sendPromptListChanged();
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

#### `onrequestdisplaymode`

Called when app requests a display mode change (fullscreen, pip, inline).

```typescript
appBridge.onrequestdisplaymode = async ({ mode }, extra) => {
  const availableModes = hostContext.availableDisplayModes ?? ["inline"];
  if (availableModes.includes(mode)) {
    currentDisplayMode = mode;
    return { mode };
  }
  return { mode: currentDisplayMode };  // Return current if requested not available
};
```

#### `onupdatemodelcontext`

Called when app updates the model context with state information.

```typescript
appBridge.onupdatemodelcontext = async ({ content, structuredContent }, extra) => {
  modelContext = { content, structuredContent, timestamp: Date.now() };
  return {};
};
```

#### `oncalltool`

Called when app calls a server tool. Typically forwards to MCP server.

```typescript
appBridge.oncalltool = async ({ name, arguments: args }, extra) => {
  return mcpClient.request(
    { method: "tools/call", params: { name, arguments: args } },
    CallToolResultSchema,
    { signal: extra.signal }
  );
};
```

#### `onlistresources`

Called when app requests the resource list.

```typescript
appBridge.onlistresources = async (params, extra) => {
  return mcpClient.request(
    { method: "resources/list", params },
    ListResourcesResultSchema
  );
};
```

#### `onreadresource`

Called when app reads a resource.

```typescript
appBridge.onreadresource = async ({ uri }, extra) => {
  return mcpClient.request(
    { method: "resources/read", params: { uri } },
    ReadResourceResultSchema
  );
};
```

#### `onlistprompts`

Called when app requests the prompt list.

```typescript
appBridge.onlistprompts = async (params, extra) => {
  return mcpClient.request(
    { method: "prompts/list", params },
    ListPromptsResultSchema
  );
};
```

#### `onsandboxready`

Called when sandbox proxy is ready to receive HTML content. Internal use.

```typescript
appBridge.onsandboxready = async () => {
  const resource = await mcpClient.readResource({ uri: "ui://my-app" });
  appBridge.sendSandboxResourceReady({ html: resource.contents[0].text });
};
```

---

## Helper Functions

### `getToolUiResourceUri()`

Extracts the UI resource URI from a tool definition.

```typescript
import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const uri = getToolUiResourceUri(tool: Tool);
// Returns: string | undefined
```

Supports both nested format (`_meta.ui.resourceUri`) and deprecated flat format (`_meta["ui/resourceUri"]`).

### `buildAllowAttribute()`

Builds iframe `allow` attribute string from permissions.

```typescript
import { buildAllowAttribute } from "@modelcontextprotocol/ext-apps/app-bridge";

const allow = buildAllowAttribute({
  microphone: {},
  clipboardWrite: {},
});
// Returns: "microphone; clipboard-write"

iframe.setAttribute("allow", allow);
```

---

## Types

### McpUiHostContext

Context provided by the host during initialization and updates.

```typescript
interface McpUiHostContext {
  theme?: "light" | "dark";
  locale?: string;
  toolInfo?: {
    tool: Tool;
    arguments?: Record<string, any>;
  };
  styles?: {
    variables?: Record<string, string>;  // CSS custom properties
    css?: {
      fonts?: string;  // Font CSS (@font-face, @import)
    };
  };
  safeAreaInsets?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  availableDisplayModes?: ("inline" | "fullscreen" | "pip")[];
}
```

### McpUiAppCapabilities

Capabilities the app can declare.

```typescript
interface McpUiAppCapabilities {
  tools?: {};  // Declare if app provides tools via oncalltool/onlisttools
}
```

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
