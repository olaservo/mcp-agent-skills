/**
 * Source: Based on MCP Tasks (SEP-1686) pattern from
 * https://github.com/modelcontextprotocol/servers/blob/main/src/everything/tools/simulate-research-query.ts
 *
 * Task demonstrating input_required status with elicitation.
 * When a task needs user clarification, elicitation is sent directly during
 * background processing. Includes HTTP transport graceful degradation.
 *
 * Customize as needed for your use case.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolResult,
  GetTaskResult,
  Task,
  ElicitResult,
  ElicitResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CreateTaskResult } from "@modelcontextprotocol/sdk/experimental/tasks";

// Tool input schema
export const AmbiguousTaskSchema = z.object({
  query: z.string().describe("Query that may be ambiguous"),
  requiresClarification: z
    .boolean()
    .default(true)
    .describe("Whether to simulate requiring clarification (triggers input_required status)"),
});

// Processing stages
const STAGES = ["Analyzing query", "Gathering context", "Processing request", "Generating response"];
const STAGE_DURATION = 1000; // 1 second per stage

// Internal state tracking per task
interface TaskState {
  query: string;
  requiresClarification: boolean;
  currentStage: number;
  clarification?: string;
  cancelled: boolean;
  completed: boolean;
  result?: CallToolResult;
}

// Map to store task state by taskId
const taskStates = new Map<string, TaskState>();

/**
 * Runs the background processing for a task.
 * Handles elicitation directly if clarification is needed.
 * Checks for cancellation between stages.
 *
 * Note: Elicitation only works on STDIO transport. On HTTP transport,
 * sendRequest will fail and the task will use a default interpretation.
 * Full HTTP support requires SDK PR #1210's elicitInputStream API.
 * See: https://github.com/modelcontextprotocol/typescript-sdk/pull/1210
 */
async function processTask(
  taskId: string,
  taskStore: {
    updateTaskStatus: (taskId: string, status: Task["status"], message?: string) => Promise<void>;
    storeTaskResult: (taskId: string, status: "completed" | "failed", result: CallToolResult) => Promise<void>;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRequest: any
): Promise<void> {
  const state = taskStates.get(taskId);
  if (!state) return;

  try {
    // Process each stage
    for (let i = state.currentStage; i < STAGES.length; i++) {
      state.currentStage = i;

      // Check if task was cancelled externally
      if (state.cancelled) {
        return; // Exit silently - cancellation is handled elsewhere
      }

      // Update status message for current stage
      await taskStore.updateTaskStatus(taskId, "working", `${STAGES[i]}...`);

      // At "Gathering context" stage (index 1), check if clarification is needed
      if (i === 1 && state.requiresClarification && !state.clarification) {
        // Update status to show we're requesting input
        await taskStore.updateTaskStatus(
          taskId,
          "input_required",
          `Query "${state.query}" is ambiguous. Requesting clarification...`
        );

        try {
          // Try elicitation via sendRequest (works on STDIO, fails on HTTP)
          const elicitResult: ElicitResult = await sendRequest(
            {
              method: "elicitation/create",
              params: {
                message: `Please clarify your query: "${state.query}"`,
                requestedSchema: {
                  type: "object",
                  properties: {
                    clarification: {
                      type: "string",
                      title: "Clarification",
                      description: "What did you mean by this query?",
                    },
                  },
                  required: ["clarification"],
                },
              },
            },
            ElicitResultSchema
          );

          // Process elicitation response
          if (elicitResult.action === "accept" && elicitResult.content) {
            state.clarification =
              (elicitResult.content as { clarification?: string }).clarification ||
              "User accepted without input";
          } else if (elicitResult.action === "decline") {
            state.clarification = "User declined - using default interpretation";
          } else {
            state.clarification = "User cancelled - using default interpretation";
          }
        } catch (error) {
          // Elicitation failed (likely HTTP transport without streaming support)
          // Use default interpretation and continue - task should still complete
          console.warn(
            `Elicitation failed for task ${taskId} (HTTP transport?):`,
            error instanceof Error ? error.message : String(error)
          );
          state.clarification = "default (elicitation unavailable on HTTP)";
        }

        // Resume with working status
        await taskStore.updateTaskStatus(
          taskId,
          "working",
          `Continuing with interpretation: "${state.clarification}"...`
        );

        // Continue processing (no return - keep going through the loop)
      }

      // Simulate work for this stage
      await new Promise((resolve) => setTimeout(resolve, STAGE_DURATION));
    }

    // All stages complete - generate result
    state.completed = true;
    const queryDisplay = state.clarification
      ? `${state.query} (clarified: ${state.clarification})`
      : state.query;

    const result: CallToolResult = {
      content: [
        {
          type: "text",
          text: `Query processed: ${queryDisplay}\n\nCompleted ${STAGES.length} stages:\n${STAGES.map((s) => `  - ${s} ✓`).join("\n")}\n\nThis demonstrates the input_required flow where tasks request user input via elicitation.`,
        },
      ],
    };
    state.result = result;

    await taskStore.storeTaskResult(taskId, "completed", result);
  } catch (error) {
    await taskStore.storeTaskResult(taskId, "failed", {
      content: [{ type: "text", text: `Error: ${String(error)}` }],
      isError: true,
    });
  }
}

// Tool configuration
const name = "ambiguous-task";
const config = {
  title: "Ambiguous Task Demo",
  description:
    "Demonstrates input_required status and elicitation with multi-stage progress. " +
    "When requiresClarification is true, sends elicitation request during processing.",
  inputSchema: AmbiguousTaskSchema,
  execution: { taskSupport: "required" as const },
};

/**
 * Registers the 'ambiguous-task' tool as a task-based tool with input_required support.
 *
 * This tool demonstrates:
 * - Multi-stage progress with status updates
 * - Elicitation directly in background process via sendRequest
 * - HTTP transport graceful degradation (falls back to default interpretation)
 * - Cancellation handling
 *
 * Note: Elicitation only works on STDIO transport. HTTP support requires SDK PR #1210.
 * See: https://github.com/modelcontextprotocol/typescript-sdk/pull/1210
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 */
export const registerAmbiguousTaskTool = (server: McpServer) => {
  // Check if client supports elicitation (needed for input_required flow)
  const clientCapabilities = server.server.getClientCapabilities() || {};
  const clientSupportsElicitation = clientCapabilities.elicitation !== undefined;

  server.experimental.tasks.registerToolTask(name, config, {
    /**
     * Creates a new task and starts background processing.
     * If clarification is needed and client supports elicitation,
     * elicitation will be sent during processing.
     */
    createTask: async (args, extra): Promise<CreateTaskResult> => {
      const validatedArgs = AmbiguousTaskSchema.parse(args);

      const task = await extra.taskStore.createTask({
        ttl: 300000, // 5 minutes TTL
        pollInterval: 1000,
      });

      // Initialize state - only require clarification if client supports elicitation
      taskStates.set(task.taskId, {
        query: validatedArgs.query,
        requiresClarification: validatedArgs.requiresClarification && clientSupportsElicitation,
        currentStage: 0,
        cancelled: false,
        completed: false,
      });

      // Start async processing - pass sendRequest for elicitation
      // (works on STDIO, gracefully degrades on HTTP)
      processTask(task.taskId, extra.taskStore, extra.sendRequest).catch((error) => {
        console.error(`Task ${task.taskId} failed:`, error);
        extra.taskStore.updateTaskStatus(task.taskId, "failed", String(error)).catch(console.error);
      });

      return { task };
    },

    /**
     * Returns the current status of the task.
     */
    getTask: async (args, extra): Promise<GetTaskResult> => {
      return await extra.taskStore.getTask(extra.taskId);
    },

    /**
     * Returns the task result.
     * Elicitation is now handled directly in the background process.
     */
    getTaskResult: async (args, extra): Promise<CallToolResult> => {
      // Return the stored result
      const result = await extra.taskStore.getTaskResult(extra.taskId);

      // Clean up state
      taskStates.delete(extra.taskId);

      return result as CallToolResult;
    },

    /**
     * Cancels a running task.
     * Called when client invokes `tasks/cancel`.
     *
     * Note: This handler is optional. If omitted, the SDK's InMemoryTaskStore
     * handles task cancellation automatically. Including it allows custom
     * cleanup logic.
     */
    cancelTask: async (args, extra): Promise<void> => {
      const state = taskStates.get(extra.taskId);
      if (state) {
        state.cancelled = true;
      }
      // The task store handles updating the task status to "cancelled"
    },
  });
};
