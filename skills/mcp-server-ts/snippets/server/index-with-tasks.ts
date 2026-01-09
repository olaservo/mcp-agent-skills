/**
 * Source: Based on MCP Tasks (SEP-1686) pattern from
 * https://github.com/modelcontextprotocol/servers/blob/main/src/everything/server/index.ts
 *
 * Server setup with Tasks capability enabled.
 * Tasks require:
 * 1. InMemoryTaskStore and InMemoryTaskMessageQueue from SDK experimental
 * 2. tasks capability declaration with sub-capabilities
 * 3. Passing taskStore and taskMessageQueue to McpServer options
 *
 * Customize as needed for your use case.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  InMemoryTaskStore,
  InMemoryTaskMessageQueue,
} from "@modelcontextprotocol/sdk/experimental";

// Server Factory response
export type ServerFactoryResponse = {
  server: McpServer;
  cleanup: () => void;
};

/**
 * Server Factory with Tasks Support
 *
 * Creates an McpServer with Tasks capability enabled.
 * The server can host task-based tools that execute asynchronously.
 *
 * @returns {ServerFactoryResponse} Server instance and cleanup function
 */
export const createServerWithTasks: () => ServerFactoryResponse = () => {
  // Create task infrastructure
  // InMemoryTaskStore - stores task state, handles TTL expiration
  // InMemoryTaskMessageQueue - handles task-related message queuing
  const taskStore = new InMemoryTaskStore();
  const taskMessageQueue = new InMemoryTaskMessageQueue();

  // Create the server with Tasks capability
  const server = new McpServer(
    {
      name: "my-mcp-server",
      title: "My MCP Server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
        // Tasks capability with sub-capabilities
        tasks: {
          list: {}, // Support tasks/list - list all tasks
          cancel: {}, // Support tasks/cancel - cancel a running task
          requests: {
            tools: {
              call: {}, // Support task-based tools/call
            },
          },
        },
      },
      // Pass task infrastructure to server
      taskStore,
      taskMessageQueue,
    }
  );

  // Register your task-enabled tools here
  // Example: registerTaskDemoTool(server);

  return {
    server,
    cleanup: () => {
      // Clean up task store timers when shutting down
      taskStore.cleanup();
    },
  };
};
