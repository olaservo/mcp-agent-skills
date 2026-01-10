/**
 * Shared types for Claude Agent UI
 *
 * Use these types in both server and client for type-safe WebSocket communication.
 */

// Message stored in chat history
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

// Tool approval request sent from server to client
export interface ToolApprovalRequest {
  type: "tool_approval_request";
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

// Tool approval response sent from client to server
export interface ToolApprovalResponse {
  type: "tool_approval_response";
  requestId: string;
  approved: boolean;
}

// WebSocket messages: Server -> Client
export type ServerMessage =
  | { type: "connected"; message: string }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "user_message"; content: string }
  | { type: "assistant_message"; content: string }
  | { type: "tool_use"; toolName: string; toolId: string; toolInput: Record<string, unknown> }
  | { type: "result"; success: boolean; cost?: number; duration?: number }
  | { type: "error"; error: string }
  | ToolApprovalRequest;

// WebSocket messages: Client -> Server
export type ClientMessage =
  | { type: "chat"; content: string }
  | ToolApprovalResponse;
