/**
 * Examples of calling MCP tools from within an app UI.
 *
 * The app can call any tool registered on the server, not just the one
 * that triggered the app.
 *
 * Customize:
 * - Replace tool names with your actual tool names
 * - Update argument schemas to match your tools
 */

import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Assume app is already created and connected
declare const app: App;

// ============================================================
// BASIC TOOL CALL
// ============================================================

async function callSimpleTool(): Promise<void> {
  try {
    const result = await app.callServerTool({
      name: "get-time",
      arguments: {},
    });

    // Extract text from result
    const text = result.content?.find((c) => c.type === "text")?.text;
    console.log("Time:", text);
  } catch (error) {
    console.error("Tool call failed:", error);
  }
}

// ============================================================
// TOOL CALL WITH ARGUMENTS
// ============================================================

interface SearchArgs {
  query: string;
  limit?: number;
}

async function callToolWithArgs(query: string): Promise<void> {
  try {
    const result = await app.callServerTool({
      name: "search",
      arguments: {
        query,
        limit: 10,
      } satisfies SearchArgs,
    });

    // Handle structured content if available
    if (result.structuredContent) {
      const data = result.structuredContent as { items: string[] };
      console.log("Search results:", data.items);
    }
  } catch (error) {
    console.error("Search failed:", error);
  }
}

// ============================================================
// HANDLING DIFFERENT RESULT TYPES
// ============================================================

async function handleResultTypes(): Promise<void> {
  const result = await app.callServerTool({
    name: "multi-output-tool",
    arguments: {},
  });

  for (const content of result.content || []) {
    switch (content.type) {
      case "text":
        console.log("Text:", content.text);
        break;

      case "image":
        // content.data is base64, content.mimeType is the image type
        const img = document.createElement("img");
        img.src = `data:${content.mimeType};base64,${content.data}`;
        document.body.appendChild(img);
        break;

      case "resource":
        // Embedded resource
        console.log("Resource URI:", content.resource.uri);
        if (content.resource.text) {
          console.log("Resource text:", content.resource.text);
        }
        break;
    }
  }

  // Check for errors
  if (result.isError) {
    console.error("Tool returned an error");
  }
}

// ============================================================
// CALLING MULTIPLE TOOLS IN SEQUENCE
// ============================================================

async function workflowExample(): Promise<void> {
  // Step 1: Fetch data
  const dataResult = await app.callServerTool({
    name: "fetch-data",
    arguments: { source: "database" },
  });

  const data = dataResult.structuredContent as { records: any[] };

  // Step 2: Process data
  const processedResult = await app.callServerTool({
    name: "process-data",
    arguments: { records: data.records },
  });

  // Step 3: Display result
  const output = processedResult.structuredContent as { summary: string };
  document.getElementById("output")!.textContent = output.summary;
}

// ============================================================
// CALLING TOOLS ON USER INTERACTION
// ============================================================

function setupInteractiveToolCalls(): void {
  // Button click triggers tool call
  document.getElementById("submit-btn")?.addEventListener("click", async () => {
    const input = document.getElementById("user-input") as HTMLInputElement;
    const output = document.getElementById("output")!;

    output.textContent = "Processing...";

    try {
      const result = await app.callServerTool({
        name: "process-input",
        arguments: { text: input.value },
      });

      output.textContent = result.content?.find((c) => c.type === "text")?.text || "";
    } catch (error) {
      output.textContent = `Error: ${error}`;
    }
  });

  // Form submission triggers tool call
  document.getElementById("form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const result = await app.callServerTool({
      name: "submit-form",
      arguments: Object.fromEntries(formData),
    });

    // Handle result...
  });
}

// ============================================================
// ERROR HANDLING PATTERNS
// ============================================================

async function robustToolCall(): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await app.callServerTool({
        name: "flaky-tool",
        arguments: {},
      });

      if (result.isError) {
        throw new Error("Tool returned error");
      }

      // Success
      console.log("Result:", result);
      return;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  // All retries failed
  console.error("All attempts failed:", lastError);
}

export {
  callSimpleTool,
  callToolWithArgs,
  handleResultTypes,
  workflowExample,
  setupInteractiveToolCalls,
  robustToolCall,
};
