/**
 * Claude Agent SDK - Tool Approval Hook
 *
 * PreToolUse hook that pauses execution for user approval.
 * Enables human-in-the-loop workflows where users can approve or reject
 * tool calls before they execute.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { HookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'events';

/**
 * Tool approval request sent to UI
 */
export interface ApprovalRequest {
  requestId: string;
  toolName: string;
  toolInput: unknown;
  timestamp: string;
}

/**
 * User's decision on a tool approval request
 */
export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  reason?: string;
}

/**
 * Callback function type for approval requests
 */
export type ApprovalCallback = (request: ApprovalRequest) => Promise<boolean>;

/**
 * Create a PreToolUse hook that pauses for user approval.
 *
 * @param onApprovalNeeded - Callback that receives approval request and returns true/false
 * @param toolsRequiringApproval - Regex pattern for tools that need approval (default: Write|Edit|Bash)
 */
export function createApprovalHook(
  onApprovalNeeded: ApprovalCallback,
  toolsRequiringApproval: string = 'Write|Edit|MultiEdit|Bash'
) {
  return {
    matcher: toolsRequiringApproval,
    hooks: [
      async (input: any): Promise<HookJSONOutput> => {
        const request: ApprovalRequest = {
          requestId: crypto.randomUUID(),
          toolName: input.tool_name,
          toolInput: input.tool_input,
          timestamp: new Date().toISOString(),
        };

        try {
          const approved = await onApprovalNeeded(request);

          if (!approved) {
            return {
              decision: 'block',
              stopReason: `User rejected ${input.tool_name} tool call`,
              continue: false,
            };
          }

          return { continue: true };
        } catch (error) {
          // On error, block the tool call for safety
          return {
            decision: 'block',
            stopReason: `Approval error: ${error}`,
            continue: false,
          };
        }
      },
    ],
  };
}

/**
 * Approval manager for handling approval requests and responses.
 * Useful for WebSocket integration where requests/responses are async.
 */
export class ApprovalManager extends EventEmitter {
  private pendingApprovals: Map<
    string,
    {
      resolve: (approved: boolean) => void;
      request: ApprovalRequest;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  private defaultTimeoutMs: number;

  constructor(defaultTimeoutMs: number = 60000) {
    super();
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Request approval for a tool call.
   * Returns a promise that resolves when user responds or times out.
   */
  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    return new Promise((resolve) => {
      // Set timeout for auto-rejection
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(request.requestId);
        this.emit('timeout', request);
        resolve(false);
      }, this.defaultTimeoutMs);

      // Store pending approval
      this.pendingApprovals.set(request.requestId, {
        resolve,
        request,
        timeout,
      });

      // Emit event for UI to handle
      this.emit('approval_needed', request);
    });
  }

  /**
   * Resolve a pending approval with user's decision.
   * Call this when user clicks approve/reject in UI.
   */
  resolveApproval(decision: ApprovalDecision): boolean {
    const pending = this.pendingApprovals.get(decision.requestId);

    if (!pending) {
      return false; // Already resolved or timed out
    }

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(decision.requestId);

    this.emit('decision', decision);
    pending.resolve(decision.approved);

    return true;
  }

  /**
   * Get all pending approval requests
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).map((p) => p.request);
  }

  /**
   * Create a hook that uses this manager
   */
  createHook(toolsRequiringApproval?: string) {
    return createApprovalHook(
      (request) => this.requestApproval(request),
      toolsRequiringApproval
    );
  }
}

/**
 * Example: Console-based approval
 */
async function consoleApprovalExample() {
  const readline = await import('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askApproval = (request: ApprovalRequest): Promise<boolean> => {
    return new Promise((resolve) => {
      console.log('\n========== APPROVAL REQUIRED ==========');
      console.log(`Tool: ${request.toolName}`);
      console.log(`Input: ${JSON.stringify(request.toolInput, null, 2)}`);
      console.log('========================================');

      rl.question('Approve? (y/n): ', (answer) => {
        resolve(answer.toLowerCase() === 'y');
      });
    });
  };

  const q = query({
    prompt: 'Create a file called test.txt with "Hello World" in it.',
    options: {
      model: 'sonnet',
      cwd: process.cwd(),
      allowedTools: ['Write', 'Read'],
      hooks: {
        PreToolUse: [createApprovalHook(askApproval)],
      },
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log('Claude:', text.text);
    }
  }

  rl.close();
}

/**
 * Example: WebSocket-based approval
 */
function websocketApprovalExample() {
  // This would be used with a WebSocket server
  const manager = new ApprovalManager(30000); // 30 second timeout

  // Listen for approval requests to send to UI
  manager.on('approval_needed', (request: ApprovalRequest) => {
    // In a real app, send this via WebSocket to the UI:
    // ws.send(JSON.stringify({ type: 'approval_request', ...request }));
    console.log('Approval needed:', request.toolName);
  });

  // Listen for decisions
  manager.on('decision', (decision: ApprovalDecision) => {
    console.log(
      `Tool ${decision.approved ? 'approved' : 'rejected'}:`,
      decision.requestId
    );
  });

  // Listen for timeouts
  manager.on('timeout', (request: ApprovalRequest) => {
    console.log('Approval timed out:', request.requestId);
  });

  // Create the hook for use with query()
  const approvalHook = manager.createHook();

  // When user responds via WebSocket:
  // manager.resolveApproval({ requestId: '...', approved: true });

  return { manager, approvalHook };
}

// Run console example if executed directly
// consoleApprovalExample().catch(console.error);

/**
 * WebSocket message protocol for tool approval:
 *
 * Server -> Client (approval request):
 * {
 *   "type": "approval_request",
 *   "requestId": "uuid-here",
 *   "toolName": "Write",
 *   "toolInput": { "file_path": "/path/to/file", "content": "..." },
 *   "timestamp": "2024-01-15T10:30:00Z"
 * }
 *
 * Client -> Server (user decision):
 * {
 *   "type": "approval_decision",
 *   "requestId": "uuid-here",
 *   "approved": true,
 *   "reason": "Looks good"  // optional
 * }
 */
