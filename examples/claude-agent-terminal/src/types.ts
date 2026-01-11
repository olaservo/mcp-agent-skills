// Message types for the terminal chat
// Aligned with claude-agent-ui-ts server protocol

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool-use' | 'tool-result';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
  error?: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'awaiting-approval' | 'completed' | 'failed';
  result?: string;
  isError?: boolean;
}

// Server message types (matching server.ts protocol)
export interface ServerChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_use';
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface ToolApprovalRequest {
  type: 'tool_approval_request';
  requestId: string;
  toolId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

// WebSocket messages from server
export type ServerMessage =
  | { type: 'connected'; message: string }
  | { type: 'history'; messages: ServerChatMessage[] }
  | { type: 'user_message'; content: string }
  | { type: 'assistant_message'; content: string }
  | { type: 'tool_use'; toolName: string; toolId: string; toolInput: Record<string, unknown> }
  | { type: 'result'; success: boolean; cost?: number; duration?: number }
  | { type: 'error'; error: string }
  | ToolApprovalRequest;

// WebSocket messages to server
export type ClientMessage =
  | { type: 'chat'; content: string }
  | { type: 'tool_approval_response'; requestId: string; approved: boolean };

// Generate a unique message ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
