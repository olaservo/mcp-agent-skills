/**
 * React MCP App with host styling support.
 *
 * Shows how to:
 * - Use useHostStyleVariables to apply host CSS variables
 * - Use useHostFonts to apply host fonts
 * - Use useHostStyles as a convenience wrapper
 * - Respond to theme changes
 *
 * Customize:
 * - Use CSS custom properties from the host
 * - Add theme-aware styling to your components
 */

import type { App } from "@modelcontextprotocol/ext-apps";
import {
  useApp,
  useHostStyleVariables,
  useHostFonts,
} from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const IMPLEMENTATION = {
  name: "Styled React App",
  version: "1.0.0",
};

/**
 * Main App Component with host styling
 */
function StyledMcpApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);

  const { app, error } = useApp({
    appInfo: IMPLEMENTATION,
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result) => {
        console.log("Tool result:", result);
        setToolResult(result);
      };
      app.onerror = console.error;
    },
  });

  // Apply host style variables and theme (CSS custom properties + color-scheme)
  useHostStyleVariables(app, app?.getHostContext());

  // Apply host fonts (@font-face rules from host)
  useHostFonts(app, app?.getHostContext());

  // Alternative: use useHostStyles() which combines both hooks
  // useHostStyles(app, app?.getHostContext());

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (!app) {
    return <LoadingState />;
  }

  return <AppContent app={app} toolResult={toolResult} />;
}

/**
 * Error state component using host styles
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "1rem",
        // Use CSS custom properties from host
        backgroundColor: "var(--color-background-error, #fee2e2)",
        color: "var(--color-text-error, #dc2626)",
        borderRadius: "var(--border-radius, 8px)",
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      <strong>Error:</strong> {message}
    </div>
  );
}

/**
 * Loading state component using host styles
 */
function LoadingState() {
  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "var(--color-background-secondary, #f5f5f5)",
        color: "var(--color-text-secondary, #666)",
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      Connecting...
    </div>
  );
}

/**
 * Main content using host CSS custom properties
 */
interface AppContentProps {
  app: App;
  toolResult: CallToolResult | null;
}

function AppContent({ app, toolResult }: AppContentProps) {
  const [theme, setTheme] = useState<"light" | "dark" | undefined>();

  // Track theme from host context
  useEffect(() => {
    const context = app.getHostContext();
    setTheme(context?.theme);
  }, [app]);

  // Extract result text
  const resultText = toolResult?.content?.find((c) => c.type === "text")?.text ?? "No result";

  return (
    <main
      style={{
        // Use CSS custom properties from host for consistent styling
        padding: "var(--spacing-lg, 1.5rem)",
        backgroundColor: "var(--color-background-primary, white)",
        color: "var(--color-text-primary, #1a1a1a)",
        fontFamily: "var(--font-sans, system-ui)",
        borderRadius: "var(--border-radius, 8px)",
        minHeight: "100vh",
      }}
    >
      {/* Header with theme-aware styling */}
      <header
        style={{
          marginBottom: "var(--spacing-md, 1rem)",
          paddingBottom: "var(--spacing-sm, 0.5rem)",
          borderBottom: "1px solid var(--color-border, #e5e5e5)",
        }}
      >
        <h1
          style={{
            fontSize: "var(--font-size-lg, 1.25rem)",
            fontWeight: "var(--font-weight-bold, 600)",
            margin: 0,
          }}
        >
          Styled MCP App
        </h1>
        <p
          style={{
            fontSize: "var(--font-size-sm, 0.875rem)",
            color: "var(--color-text-secondary, #666)",
            margin: "0.25rem 0 0",
          }}
        >
          Theme: {theme ?? "unknown"}
        </p>
      </header>

      {/* Result display using host styles */}
      <section
        style={{
          padding: "var(--spacing-md, 1rem)",
          backgroundColor: "var(--color-background-secondary, #f9fafb)",
          borderRadius: "var(--border-radius-sm, 4px)",
          marginBottom: "var(--spacing-md, 1rem)",
        }}
      >
        <h2
          style={{
            fontSize: "var(--font-size-md, 1rem)",
            fontWeight: "var(--font-weight-medium, 500)",
            margin: "0 0 0.5rem",
          }}
        >
          Result
        </h2>
        <code
          style={{
            display: "block",
            padding: "var(--spacing-sm, 0.5rem)",
            backgroundColor: "var(--color-background-code, #f0f0f0)",
            borderRadius: "var(--border-radius-sm, 4px)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "var(--font-size-sm, 0.875rem)",
          }}
        >
          {resultText}
        </code>
      </section>

      {/* Action button using host styles */}
      <button
        onClick={() => {
          app.callServerTool({ name: "get-time", arguments: {} });
        }}
        style={{
          padding: "var(--spacing-sm, 0.5rem) var(--spacing-md, 1rem)",
          backgroundColor: "var(--color-primary, #3b82f6)",
          color: "var(--color-primary-text, white)",
          border: "none",
          borderRadius: "var(--border-radius, 8px)",
          fontFamily: "var(--font-sans, system-ui)",
          fontSize: "var(--font-size-md, 1rem)",
          cursor: "pointer",
        }}
      >
        Refresh
      </button>
    </main>
  );
}

/**
 * Mount the React app
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StyledMcpApp />
  </StrictMode>
);
