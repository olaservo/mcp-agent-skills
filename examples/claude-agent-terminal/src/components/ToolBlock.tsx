/**
 * ToolBlock - Displays a tool call with its status, args, result, and approval UI
 */

import { ActionIcon, Collapse } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChevronDown,
  IconChevronRight,
  IconTool,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import type { ToolCallInfo } from '../types';

interface ToolBlockProps {
  toolCall: ToolCallInfo;
  onApprove?: () => void;
  onReject?: () => void;
}

export function ToolBlock({ toolCall, onApprove, onReject }: ToolBlockProps) {
  const [expanded, { toggle }] = useDisclosure(false);
  const hasArgs = Object.keys(toolCall.arguments).length > 0;
  const hasResult = toolCall.result !== undefined;
  const needsApproval = toolCall.status === 'awaiting-approval';

  return (
    <div className="terminal-tool-call">
      {/* Header */}
      <div className="terminal-tool-call-header">
        <IconTool size={14} />
        <span>{toolCall.name}</span>
        <span className={`terminal-tool-call-status terminal-tool-call-status-${toolCall.status}`}>
          {getStatusLabel(toolCall.status)}
        </span>
        {(hasArgs || hasResult) && (
          <ActionIcon size="xs" variant="subtle" onClick={toggle} color="gray">
            {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </ActionIcon>
        )}
      </div>

      {/* Approval UI */}
      {needsApproval && onApprove && onReject && (
        <div className="terminal-tool-approval">
          <span className="terminal-tool-approval-text">
            Allow this tool to run?
          </span>
          <button
            className="terminal-tool-approval-btn terminal-tool-approval-btn-approve"
            onClick={onApprove}
          >
            <IconCheck size={12} style={{ marginRight: 4 }} />
            Approve
          </button>
          <button
            className="terminal-tool-approval-btn terminal-tool-approval-btn-reject"
            onClick={onReject}
          >
            <IconX size={12} style={{ marginRight: 4 }} />
            Reject
          </button>
        </div>
      )}

      {/* Arguments (collapsible) */}
      <Collapse in={expanded}>
        {hasArgs && (
          <div className="terminal-tool-call-args">
            <pre>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
          </div>
        )}

        {/* Result */}
        {hasResult && (
          <div
            className={`terminal-tool-result ${toolCall.isError ? 'terminal-tool-result-error' : ''}`}
          >
            <div className="terminal-tool-result-header">
              Result:
            </div>
            <div className="terminal-tool-result-content">
              <pre>{toolCall.result}</pre>
            </div>
          </div>
        )}
      </Collapse>
    </div>
  );
}

function getStatusLabel(status: ToolCallInfo['status']): string {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'executing':
      return 'running...';
    case 'awaiting-approval':
      return 'awaiting approval';
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    default:
      return status;
  }
}
