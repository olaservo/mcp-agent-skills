/**
 * Source: Based on MCP Tasks (SEP-1686) pattern from
 * https://github.com/modelcontextprotocol/servers/blob/main/src/everything/tools/simulate-research-query.ts
 *
 * Basic task-enabled tool demonstrating the MCP Tasks lifecycle.
 * Tasks enable "call now, fetch later" patterns for long-running operations.
 *
 * Task States:
 *   - working: Task is actively processing
 *   - completed: Task finished successfully
 *   - failed: Task encountered an error
 *   - input_required: Task needs additional input (requires elicitation)
 *   - cancelled: Task was cancelled
 *
 * Customize as needed for your use case.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult, GetTaskResult, Task } from "@modelcontextprotocol/sdk/types.js";
import { CreateTaskResult } from "@modelcontextprotocol/sdk/experimental";

// Tool input schema
export const TaskDemoSchema = z.object({
  message: z.string().describe("Message to process"),
});

// Processing stages for multi-stage progress
const STAGES = ["Validating input", "Processing message", "Generating response"];
const STAGE_DURATION = 1000; // 1 second per stage

// Internal state tracking per task
interface TaskState {
  message: string;
  currentStage: number;
  cancelled: boolean;
  completed: boolean;
  result?: CallToolResult;
}

// Map to store task state by taskId
const taskStates = new Map<string, TaskState>();

/**
 * Runs the background processing for a task.
 * Updates task status as it progresses through stages.
 * Checks for cancellation between stages.
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
    // Process each stage
    for (let i = state.currentStage; i < STAGES.length; i++) {
      state.currentStage = i;

      // Check if task was cancelled externally
      if (state.cancelled) {
        return; // Exit silently - cancellation is handled elsewhere
      }

      // Update status message for current stage
      await taskStore.updateTaskStatus(taskId, "working", `${STAGES[i]}...`);

      // Simulate work for this stage
      await new Promise((resolve) => setTimeout(resolve, STAGE_DURATION));
    }

    // All stages complete - generate result
    state.completed = true;
    const result: CallToolResult = {
      content: [
        {
          type: "text",
          text: `Processed: ${state.message}\n\nCompleted ${STAGES.length} stages:\n${STAGES.map((s) => `  - ${s} ✓`).join("\n")}`,
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
const name = "task-demo";
const config = {
  title: "Task Demo",
  description:
    "Demonstrates basic task-based execution pattern with multi-stage progress. " +
    "Creates a task that processes asynchronously through multiple stages.",
  inputSchema: TaskDemoSchema,
  execution: { taskSupport: "required" as const },
};

/**
 * Registers the 'task-demo' tool as a task-based tool.
 *
 * Key concepts:
 * - Uses `server.experimental.tasks.registerToolTask()` instead of `server.registerTool()`
 * - Implements three handlers: createTask, getTask, getTaskResult
 * - Task creation returns immediately with a taskId
 * - Client polls getTask for status updates
 * - Client calls getTaskResult when status is "completed"
 * - Supports cancellation via state flag checked between stages
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 */
export const registerTaskDemoTool = (server: McpServer) => {
  server.experimental.tasks.registerToolTask(name, config, {
    /**
     * Creates a new task and starts background processing.
     * Called when client invokes `tools/call` with task parameter.
     */
    createTask: async (args, extra): Promise<CreateTaskResult> => {
      const validatedArgs = TaskDemoSchema.parse(args);

      // Create task in store with TTL and poll interval
      const task = await extra.taskStore.createTask({
        ttl: 60000, // 1 minute TTL (auto-cleanup)
        pollInterval: 500, // Client should poll every 500ms
      });

      // Initialize state tracking
      taskStates.set(task.taskId, {
        message: validatedArgs.message,
        currentStage: 0,
        cancelled: false,
        completed: false,
      });

      // Start async processing (don't await - runs in background)
      processTask(task.taskId, extra.taskStore).catch((error) => {
        console.error(`Task ${task.taskId} failed:`, error);
        extra.taskStore.updateTaskStatus(task.taskId, "failed", String(error)).catch(console.error);
      });

      return { task };
    },

    /**
     * Returns the current status of the task.
     * Called when client invokes `tasks/get`.
     */
    getTask: async (args, extra): Promise<GetTaskResult> => {
      return await extra.taskStore.getTask(extra.taskId);
    },

    /**
     * Returns the task result when completed.
     * Called when client invokes `tasks/result`.
     */
    getTaskResult: async (args, extra): Promise<CallToolResult> => {
      const result = await extra.taskStore.getTaskResult(extra.taskId);

      // Clean up state
      taskStates.delete(extra.taskId);

      return result as CallToolResult;
    },

    /**
     * Cancels a running task.
     * Called when client invokes `tasks/cancel`.
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
