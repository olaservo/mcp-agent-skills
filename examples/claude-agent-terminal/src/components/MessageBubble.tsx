/**
 * MessageBubble - Renders individual chat messages with terminal styling
 */

import type { ChatMessage } from '../types';
import { ToolBlock } from './ToolBlock';

interface MessageBubbleProps {
  message: ChatMessage;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

export function MessageBubble({ message, onApprove, onReject }: MessageBubbleProps) {
  const roleClass = getRoleClass(message.role);
  const streamingClass = message.isStreaming ? 'terminal-message-streaming' : '';
  const errorClass = message.error ? 'terminal-message-error' : '';

  return (
    <div className={`terminal-message ${roleClass} ${streamingClass} ${errorClass}`.trim()}>
      {/* Main content */}
      {message.content && (
        <div className="terminal-message-content">
          {message.content}
        </div>
      )}

      {/* Error display */}
      {message.error && (
        <div className="terminal-message-error">
          Error: {message.error}
        </div>
      )}

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="terminal-message-tool-calls">
          {message.toolCalls.map((toolCall) => (
            <ToolBlock
              key={toolCall.id}
              toolCall={toolCall}
              onApprove={onApprove ? () => onApprove(toolCall.id) : undefined}
              onReject={onReject ? () => onReject(toolCall.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getRoleClass(role: ChatMessage['role']): string {
  switch (role) {
    case 'user':
      return 'terminal-message-user';
    case 'assistant':
      return 'terminal-message-assistant';
    case 'system':
      return 'terminal-message-system';
    case 'tool-result':
      return 'terminal-message-assistant';
    default:
      return '';
  }
}
