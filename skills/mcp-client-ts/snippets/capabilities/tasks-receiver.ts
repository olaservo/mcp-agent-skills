/**
 * Tasks Receiver - Handle task-augmented requests when client is the receiver
 *
 * Source: Based on MCP Inspector's useConnection.ts implementation
 * https://github.com/modelcontextprotocol/inspector/blob/main/client/src/lib/hooks/useConnection.ts
 *
 * When a server sends task-augmented requests (e.g., sampling/createMessage or
 * elicitation/create with `params.task`), the client becomes the task receiver.
 * This module provides the infrastructure to handle these bidirectional tasks.
 *
 * Usage:
 *   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 *   import {
 *     createReceiverTaskManager,
 *     setupReceiverTaskHandlers,
 *   } from './capabilities/tasks-receiver.js';
 *
 *   const taskManager = createReceiverTaskManager({ ttl: 300000 });
 *   setupReceiverTaskHandlers(client, taskManager);
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  Task,
  ListTasksRequestSchema,
  GetTaskRequestSchema,
  GetTaskPayloadRequestSchema,
  CancelTaskRequestSchema,
  ClientNotification,
  ClientResult,
} from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Record for tracking a task created in response to an incoming request.
 * Used when the client is the task receiver (bidirectional tasks).
 */
export interface ReceiverTaskRecord {
  /** The task object with current state */
  task: Task;
  /** Promise that resolves with the task's final payload/result */
  payloadPromise: Promise<ClientResult>;
  /** Resolve the payload promise */
  resolvePayload: (payload: ClientResult) => void;
  /** Reject the payload promise */
  rejectPayload: (reason?: unknown) => void;
  /** Cleanup timeout ID for TTL-based expiration */
  cleanupTimeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Configuration for the receiver task manager.
 */
export interface ReceiverTaskManagerConfig {
  /** Default TTL for tasks in milliseconds. Default: 300000 (5 minutes) */
  ttl?: number;
  /** Default poll interval in milliseconds. Default: 1000 */
  pollInterval?: number;
  /** Callback for logging */
  onLog?: (message: string) => void;
}

/**
 * Options for creating a receiver task.
 */
export interface CreateReceiverTaskOptions {
  /** TTL for this specific task (overrides default) */
  ttl?: number;
  /** Initial status for the task */
  initialStatus: Task['status'];
  /** Optional status message */
  statusMessage?: string;
  /** Poll interval for this specific task */
  pollInterval?: number;
}

// ============================================================================
// RECEIVER TASK MANAGER
// ============================================================================

/**
 * Creates a manager for handling tasks when the client is the receiver.
 *
 * @param config - Configuration options
 * @returns Task manager with methods for creating and managing receiver tasks
 */
export function createReceiverTaskManager(config?: ReceiverTaskManagerConfig) {
  const defaultTtl = config?.ttl ?? 300000; // 5 minutes
  const defaultPollInterval = config?.pollInterval ?? 1000;
  const log = config?.onLog ?? (() => {});

  // Storage for receiver tasks
  const receiverTasks = new Map<string, ReceiverTaskRecord>();

  /**
   * Generate a unique task ID.
   */
  function makeTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  /**
   * Get current ISO timestamp.
   */
  function nowIso(): string {
    return new Date().toISOString();
  }

  /**
   * Create a new receiver task.
   * Called when the client receives a task-augmented request.
   */
  function createTask(opts: CreateReceiverTaskOptions): ReceiverTaskRecord {
    const taskId = makeTaskId();
    const createdAt = nowIso();
    const ttl = opts.ttl ?? defaultTtl;

    let resolvePayload: (payload: ClientResult) => void = () => undefined;
    let rejectPayload: (reason?: unknown) => void = () => undefined;

    const payloadPromise = new Promise<ClientResult>((resolve, reject) => {
      resolvePayload = resolve;
      rejectPayload = reject;
    });

    const task: Task = {
      taskId,
      status: opts.initialStatus,
      ttl,
      createdAt,
      lastUpdatedAt: createdAt,
      ...(opts.pollInterval !== undefined
        ? { pollInterval: opts.pollInterval }
        : { pollInterval: defaultPollInterval }),
      ...(opts.statusMessage ? { statusMessage: opts.statusMessage } : {}),
    };

    const record: ReceiverTaskRecord = {
      task,
      payloadPromise,
      resolvePayload,
      rejectPayload,
    };

    // Schedule cleanup after TTL (best-effort)
    if (ttl !== null && ttl > 0) {
      record.cleanupTimeoutId = setTimeout(() => {
        receiverTasks.delete(taskId);
        log(`[ReceiverTasks] Task ${taskId} expired after TTL`);
      }, ttl);
    }

    receiverTasks.set(taskId, record);
    log(`[ReceiverTasks] Created task ${taskId} with status ${opts.initialStatus}`);

    return record;
  }

  /**
   * Get a task by ID.
   */
  function getTask(taskId: string): ReceiverTaskRecord | undefined {
    return receiverTasks.get(taskId);
  }

  /**
   * Update a task's status.
   */
  function updateTask(taskId: string, updates: Partial<Pick<Task, 'status' | 'statusMessage'>>): Task | null {
    const record = receiverTasks.get(taskId);
    if (!record) return null;

    if (updates.status !== undefined) {
      record.task.status = updates.status;
    }
    if (updates.statusMessage !== undefined) {
      record.task.statusMessage = updates.statusMessage;
    }
    record.task.lastUpdatedAt = nowIso();

    log(`[ReceiverTasks] Updated task ${taskId}: ${record.task.status}`);
    return record.task;
  }

  /**
   * Complete a task with a result.
   */
  function completeTask(taskId: string, result: ClientResult): void {
    const record = receiverTasks.get(taskId);
    if (!record) return;

    record.task.status = 'completed';
    record.task.lastUpdatedAt = nowIso();
    record.resolvePayload(result);

    log(`[ReceiverTasks] Completed task ${taskId}`);
  }

  /**
   * Fail a task with an error.
   */
  function failTask(taskId: string, error: Error): void {
    const record = receiverTasks.get(taskId);
    if (!record) return;

    record.task.status = 'failed';
    record.task.statusMessage = error.message;
    record.task.lastUpdatedAt = nowIso();
    record.rejectPayload(error);

    log(`[ReceiverTasks] Failed task ${taskId}: ${error.message}`);
  }

  /**
   * Cancel a task.
   */
  function cancelTask(taskId: string): boolean {
    const record = receiverTasks.get(taskId);
    if (!record) return false;

    // Can only cancel non-terminal tasks
    if (record.task.status === 'completed' || record.task.status === 'failed' || record.task.status === 'cancelled') {
      return false;
    }

    record.task.status = 'cancelled';
    record.task.lastUpdatedAt = nowIso();
    record.rejectPayload(new Error('Task cancelled'));

    log(`[ReceiverTasks] Cancelled task ${taskId}`);
    return true;
  }

  /**
   * List all tasks.
   */
  function listTasks(): Task[] {
    return Array.from(receiverTasks.values()).map((r) => r.task);
  }

  /**
   * Clear all tasks and cleanup timers.
   */
  function cleanup(): void {
    for (const record of receiverTasks.values()) {
      if (record.cleanupTimeoutId) {
        clearTimeout(record.cleanupTimeoutId);
      }
    }
    receiverTasks.clear();
    log('[ReceiverTasks] Cleaned up all tasks');
  }

  return {
    createTask,
    getTask,
    updateTask,
    completeTask,
    failTask,
    cancelTask,
    listTasks,
    cleanup,
  };
}

export type ReceiverTaskManager = ReturnType<typeof createReceiverTaskManager>;

// ============================================================================
// TASK STATUS NOTIFICATIONS
// ============================================================================

/**
 * Emit a task status notification to the server.
 * This is best-effort - task status notifications are optional per spec.
 *
 * @param client - The MCP client
 * @param task - The task to notify about
 */
export async function emitTaskStatusNotification(client: Client, task: Task): Promise<void> {
  try {
    const notification: ClientNotification = {
      method: 'notifications/tasks/status',
      params: task,
    } as unknown as ClientNotification;

    await client.notification(notification);
  } catch (e) {
    // Best-effort - don't fail if notification fails
    console.warn('Failed to send notifications/tasks/status', e);
  }
}

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

/**
 * Set up request handlers for when the client is a task receiver.
 *
 * This enables the server to:
 * - List tasks the client is managing
 * - Get task status
 * - Get task payload/result
 * - Cancel tasks
 *
 * @param client - The MCP client
 * @param taskManager - The receiver task manager
 */
export function setupReceiverTaskHandlers(
  client: Client,
  taskManager: ReceiverTaskManager
): void {
  // List all tasks
  client.setRequestHandler(ListTasksRequestSchema, async () => {
    const tasks = taskManager.listTasks();
    return { tasks };
  });

  // Get a specific task
  client.setRequestHandler(GetTaskRequestSchema, async (request) => {
    const record = taskManager.getTask(request.params.taskId);
    if (!record) {
      throw new Error(`Task not found: ${request.params.taskId}`);
    }
    return record.task;
  });

  // Get task payload (blocks until result is available)
  client.setRequestHandler(GetTaskPayloadRequestSchema, async (request) => {
    const record = taskManager.getTask(request.params.taskId);
    if (!record) {
      throw new Error(`Task not found: ${request.params.taskId}`);
    }
    return await record.payloadPromise;
  });

  // Cancel a task
  client.setRequestHandler(CancelTaskRequestSchema, async (request) => {
    const cancelled = taskManager.cancelTask(request.params.taskId);
    if (!cancelled) {
      throw new Error(`Cannot cancel task: ${request.params.taskId}`);
    }
    return {};
  });
}

// ============================================================================
// CAPABILITY DECLARATION HELPER
// ============================================================================

/**
 * Get the task capability declaration for a client that supports receiver tasks.
 *
 * Use this when creating a client that can receive task-augmented requests
 * for sampling and/or elicitation.
 *
 * @param options - Which request types to support as tasks
 * @returns Task capability object for client initialization
 */
export function getReceiverTaskCapabilities(options: {
  sampling?: boolean;
  elicitation?: boolean;
} = {}): object {
  const requests: Record<string, Record<string, object>> = {};

  if (options.sampling) {
    requests.sampling = { createMessage: {} };
  }
  if (options.elicitation) {
    requests.elicitation = { create: {} };
  }

  return {
    list: {},
    cancel: {},
    ...(Object.keys(requests).length > 0 ? { requests } : {}),
  };
}
