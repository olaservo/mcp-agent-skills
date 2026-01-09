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
  delayMs: z.number().default(3000).describe("Processing delay in milliseconds"),
});

// Internal state tracking per task
interface TaskState {
  message: string;
  completed: boolean;
  result?: CallToolResult;
}

// Map to store task state by taskId
const taskStates = new Map<string, TaskState>();

/**
 * Runs the background processing for a task.
 * Updates task status and stores result when complete.
 */
async function processTask(
  taskId: string,
  args: z.infer<typeof TaskDemoSchema>,
  taskStore: {
    updateTaskStatus: (taskId: string, status: Task["status"], message?: string) => Promise<void>;
    storeTaskResult: (taskId: string, status: "completed" | "failed", result: CallToolResult) => Promise<void>;
  }
): Promise<void> {
  const state = taskStates.get(taskId);
  if (!state) return;

  try {
    // Update status to working with progress message
    await taskStore.updateTaskStatus(taskId, "working", "Processing message...");

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, args.delayMs));

    // Mark complete and store result
    state.completed = true;
    const result: CallToolResult = {
      content: [{ type: "text", text: `Processed: ${state.message}` }],
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
    "Demonstrates basic task-based execution pattern. " +
    "Creates a task that processes asynchronously and can be polled for status.",
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
        completed: false,
      });

      // Start async processing (don't await - runs in background)
      processTask(task.taskId, validatedArgs, extra.taskStore).catch((error) => {
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
  });
};
