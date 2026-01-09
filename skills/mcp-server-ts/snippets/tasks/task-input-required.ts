/**
 * Source: Based on MCP Tasks (SEP-1686) pattern from
 * https://github.com/modelcontextprotocol/servers/blob/main/src/everything/tools/simulate-research-query.ts
 *
 * Task demonstrating input_required status with elicitation.
 * When a task needs user clarification, it pauses in input_required state.
 * The client calls tasks/result to trigger elicitation via side-channel.
 *
 * Customize as needed for your use case.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolResult,
  GetTaskResult,
  Task,
  ElicitResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CreateTaskResult } from "@modelcontextprotocol/sdk/experimental";

// Tool input schema
export const AmbiguousTaskSchema = z.object({
  query: z.string().describe("Query that may be ambiguous"),
  requiresClarification: z
    .boolean()
    .default(true)
    .describe("Whether to simulate requiring clarification (triggers input_required status)"),
});

// Internal state tracking per task
interface TaskState {
  query: string;
  requiresClarification: boolean;
  waitingForClarification: boolean;
  clarification?: string;
  completed: boolean;
  result?: CallToolResult;
}

// Map to store task state by taskId
const taskStates = new Map<string, TaskState>();

/**
 * Runs the background processing for a task.
 * May pause for clarification if needed.
 */
async function processTask(
  taskId: string,
  taskStore: {
    updateTaskStatus: (taskId: string, status: Task["status"], message?: string) => Promise<void>;
    storeTaskResult: (taskId: string, status: "completed" | "failed", result: CallToolResult) => Promise<void>;
  }
): Promise<void> {
  const state = taskStates.get(taskId);
  if (!state) return;

  try {
    await taskStore.updateTaskStatus(taskId, "working", "Analyzing query...");

    // Simulate initial processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if clarification is needed
    if (state.requiresClarification && !state.clarification) {
      state.waitingForClarification = true;
      await taskStore.updateTaskStatus(
        taskId,
        "input_required",
        `Query "${state.query}" is ambiguous. Please clarify your intent.`
      );
      // Processing pauses here - getTaskResult will resume it after elicitation
      return;
    }

    // Continue processing (either no clarification needed, or already received)
    await taskStore.updateTaskStatus(taskId, "working", "Processing with clarification...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Complete the task
    state.completed = true;
    const queryDisplay = state.clarification
      ? `${state.query} (clarified: ${state.clarification})`
      : state.query;

    const result: CallToolResult = {
      content: [
        {
          type: "text",
          text: `Query processed: ${queryDisplay}\n\nThis demonstrates the input_required flow where tasks can pause for user input.`,
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
    "Demonstrates input_required status and elicitation side-channel. " +
    "When requiresClarification is true, the task pauses and requests user input via elicitation.",
  inputSchema: AmbiguousTaskSchema,
  execution: { taskSupport: "required" as const },
};

/**
 * Registers the 'ambiguous-task' tool as a task-based tool with input_required support.
 *
 * This tool demonstrates:
 * - Task pausing in input_required state
 * - Using elicitation as a side-channel in getTaskResult
 * - Resuming processing after receiving user input
 *
 * Note: Only works when client supports elicitation capability.
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 */
export const registerAmbiguousTaskTool = (server: McpServer) => {
  // Check if client supports elicitation (needed for input_required flow)
  const clientCapabilities = server.server.getClientCapabilities() || {};
  const clientSupportsElicitation = clientCapabilities.elicitation !== undefined;

  server.experimental.tasks.registerToolTask(name, config, {
    /**
     * Creates a new task. If clarification is needed and client supports elicitation,
     * the task will pause in input_required state.
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
        waitingForClarification: false,
        completed: false,
      });

      // Start async processing
      processTask(task.taskId, extra.taskStore).catch((error) => {
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
     * Returns the task result, or handles input_required via elicitation side-channel.
     *
     * When status is input_required:
     * 1. Sends elicitation request to get user clarification
     * 2. Stores clarification in task state
     * 3. Resumes background processing
     * 4. Returns indication that work is resuming (client should poll again)
     */
    getTaskResult: async (args, extra): Promise<CallToolResult> => {
      const task = await extra.taskStore.getTask(extra.taskId);
      const state = taskStates.get(extra.taskId);

      // Handle input_required - use tasks/result as side-channel for elicitation
      if (task?.status === "input_required" && state?.waitingForClarification) {
        // Send elicitation request through the side-channel
        const elicitationResult = await extra.sendRequest(
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
          ElicitResultSchema,
          { timeout: 5 * 60 * 1000 } // 5 minute timeout for user response
        );

        // Process elicitation response
        if (elicitationResult.action === "accept" && elicitationResult.content) {
          state.clarification =
            (elicitationResult.content as { clarification?: string }).clarification ||
            "User accepted without input";
        } else if (elicitationResult.action === "decline") {
          state.clarification = "User declined - using default interpretation";
        } else {
          state.clarification = "User cancelled - using default interpretation";
        }

        state.waitingForClarification = false;

        // Resume background processing
        processTask(extra.taskId, extra.taskStore).catch((error) => {
          console.error(`Task ${extra.taskId} failed:`, error);
          extra.taskStore.updateTaskStatus(extra.taskId, "failed", String(error)).catch(console.error);
        });

        // Return indication that work is resuming (client should poll again)
        return {
          content: [
            {
              type: "text",
              text: `Resuming with clarification: "${state.clarification}"`,
            },
          ],
        };
      }

      // Normal case: return the stored result
      const result = await extra.taskStore.getTaskResult(extra.taskId);

      // Clean up state
      taskStates.delete(extra.taskId);

      return result as CallToolResult;
    },
  });
};
