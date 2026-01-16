/**
 * Source: https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-server-react/src/mcp-app.tsx
 *
 * React-based MCP App using the useApp hook with all handlers.
 *
 * Customize:
 * - Update app name and version in IMPLEMENTATION
 * - Modify the component UI for your use case
 * - Add additional state and handlers as needed
 */

import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// App implementation info
const IMPLEMENTATION = {
  name: "React MCP App",
  version: "1.0.0",
};

// Logging helper
const log = {
  info: console.log.bind(console, "[APP]"),
  warn: console.warn.bind(console, "[APP]"),
  error: console.error.bind(console, "[APP]"),
};

// Helper to extract text from tool result
function extractText(result: CallToolResult): string {
  const textContent = result.content?.find((c) => c.type === "text");
  return textContent ? textContent.text : "";
}

/**
 * Main App Component
 *
 * Uses the useApp hook to manage MCP App lifecycle.
 * Handlers are registered in onAppCreated callback.
 */
function MyMcpApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: IMPLEMENTATION,
    capabilities: {},

    // Register handlers when app is created (before connect)
    onAppCreated: (app) => {
      // Called when app is being torn down
      app.onteardown = async () => {
        log.info("App is being torn down");
        return {};
      };

      // Called when tool input is received
      app.ontoolinput = async (input) => {
        log.info("Received tool input:", input);
      };

      // Called when tool result is received
      app.ontoolresult = async (result) => {
        log.info("Received tool result:", result);
        setToolResult(result);
      };

      // Called when tool execution is cancelled
      app.ontoolcancelled = (params) => {
        log.warn("Tool call cancelled:", params.reason);
      };

      // Called when host context changes (theme, locale, styles)
      app.onhostcontextchanged = (params) => {
        log.info("Host context changed:", params);
        setHostContext((prev) => ({ ...prev, ...params }));
      };

      // Error handler
      app.onerror = log.error;
    },
  });

  // Get initial host context after connection
  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext());
    }
  }, [app]);

  // Show error state
  if (error) {
    return (
      <div style={{ color: "red" }}>
        <strong>ERROR:</strong> {error.message}
      </div>
    );
  }

  // Show loading state
  if (!app) {
    return <div>Connecting...</div>;
  }

  // Render main UI
  return <AppUI app={app} toolResult={toolResult} hostContext={hostContext} />;
}

/**
 * Inner UI Component
 *
 * Receives the connected app instance and can call tools.
 */
interface AppUIProps {
  app: App;
  toolResult: CallToolResult | null;
  hostContext?: McpUiHostContext;
}

function AppUI({ app, toolResult, hostContext }: AppUIProps) {
  const [displayText, setDisplayText] = useState("Loading...");
  const [messageText, setMessageText] = useState("Hello from the app!");
  const [isLoading, setIsLoading] = useState(false);

  // Update display when tool result changes
  useEffect(() => {
    if (toolResult) {
      setDisplayText(extractText(toolResult));
    }
  }, [toolResult]);

  // Handler to call tool manually
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      log.info("Calling tool...");
      const result = await app.callServerTool({
        name: "get-time",
        arguments: {},
      });
      log.info("Tool result:", result);
      setDisplayText(extractText(result));
    } catch (error) {
      log.error("Tool call failed:", error);
      setDisplayText("[ERROR]");
    } finally {
      setIsLoading(false);
    }
  }, [app]);

  // Handler to send message to host
  const handleSendMessage = useCallback(async () => {
    const signal = AbortSignal.timeout(5000);
    try {
      log.info("Sending message:", messageText);
      const { isError } = await app.sendMessage(
        { role: "user", content: [{ type: "text", text: messageText }] },
        { signal }
      );
      log.info("Message", isError ? "rejected" : "accepted");
    } catch (error) {
      log.error("Message send error:", signal.aborted ? "timed out" : error);
    }
  }, [app, messageText]);

  // Handler to send log to host
  const handleSendLog = useCallback(async () => {
    log.info("Sending log...");
    await app.sendLog({ level: "info", data: "Log from React app" });
  }, [app]);

  // Handler to request opening a link
  const handleOpenLink = useCallback(async () => {
    log.info("Requesting to open link...");
    const { isError } = await app.openLink({
      url: "https://modelcontextprotocol.io/",
    });
    log.info("Open link request", isError ? "rejected" : "accepted");
  }, [app]);

  return (
    <main
      style={{
        padding: "1rem",
        fontFamily: "system-ui",
        // Apply safe area insets from host context
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      <p style={{ color: "#666", fontSize: "0.875rem" }}>
        Watch activity in the DevTools console!
      </p>

      {/* Display tool result */}
      <section style={{ marginBottom: "1rem" }}>
        <p>
          <strong>Result:</strong>{" "}
          <code style={{ background: "#f0f0f0", padding: "0.25rem" }}>
            {displayText}
          </code>
        </p>
        <button onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </section>

      {/* Send message to host */}
      <section style={{ marginBottom: "1rem" }}>
        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          rows={2}
          style={{ width: "100%", marginBottom: "0.5rem" }}
        />
        <button onClick={handleSendMessage}>Send Message</button>
      </section>

      {/* Other actions */}
      <section style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={handleSendLog}>Send Log</button>
        <button onClick={handleOpenLink}>Open MCP Docs</button>
      </section>

      {/* Display host context info */}
      {hostContext && (
        <section style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#888" }}>
          <p>Theme: {hostContext.theme ?? "unknown"}</p>
          <p>Locale: {hostContext.locale ?? "unknown"}</p>
          <p>Display modes: {hostContext.availableDisplayModes?.join(", ") ?? "none"}</p>
        </section>
      )}
    </main>
  );
}

/**
 * Mount the React app
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MyMcpApp />
  </StrictMode>
);
