/**
 * Sampling Capability - Handle server-initiated LLM requests with tool support
 *
 * This module is standalone. Copy this file to add sampling support to any MCP client.
 *
 * Usage:
 *   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 *   import { setupSampling } from './sampling.js';
 *
 *   const client = new Client(
 *     { name: 'my-client', version: '1.0.0' },
 *     { capabilities: { sampling: { tools: {} } } }  // Declare capability with tools
 *   );
 *
 *   setupSampling(client, { apiKey: 'your-key' });
 *   await client.connect(transport);
 *
 * Tool Support (MCP 2025-11-25):
 *   - Server can include `tools` array in sampling request
 *   - Client forwards tools to LLM
 *   - If LLM wants to use tools, client returns `stopReason: "toolUse"` with ToolUseContent
 *   - Server executes tools and sends continuation request with tool_results
 *   - Loop continues until final response
 *
 * Note: After connecting, check client.getInstructions() for server-provided
 * guidance on how to use tools effectively.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlockParam, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  CreateMessageRequestSchema,
  type CreateMessageResult,
  type CreateMessageResultWithTools,
  type SamplingMessage,
  type Tool,
  type ToolChoice,
  type ToolUseContent,
  type ToolResultContent,
  type TextContent,
  type ImageContent,
} from '@modelcontextprotocol/sdk/types.js';

// Union type for sampling responses - supports both text-only and tool-use cases
type SamplingResponse = CreateMessageResult | CreateMessageResultWithTools;

// ============================================================================
// TYPES
// ============================================================================

export interface SamplingConfig {
  /** Anthropic API key (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Model to use (default: claude-sonnet-4-20250514) */
  model?: string;
  /** Max tokens if not specified in request (default: 1024) */
  defaultMaxTokens?: number;
}

// Content block types from MCP
type SamplingContentBlock = TextContent | ImageContent | ToolUseContent | ToolResultContent;

// ============================================================================
// TYPE CONVERTERS - MCP <-> Anthropic
// ============================================================================

/**
 * Convert MCP Tool to Anthropic Tool format.
 * MCP uses `inputSchema`, Anthropic uses `input_schema`.
 */
function mcpToolToAnthropic(tool: Tool): Anthropic.Messages.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Messages.Tool['input_schema'],
  };
}

/**
 * Convert MCP ToolChoice to Anthropic ToolChoice.
 * MCP uses mode-based enum, Anthropic uses type-based objects.
 */
function mcpToolChoiceToAnthropic(choice: ToolChoice): Anthropic.Messages.ToolChoice {
  switch (choice.mode) {
    case 'auto':
      return { type: 'auto' };
    case 'required':
      return { type: 'any' }; // Anthropic's "any" = must use a tool
    case 'none':
      // Anthropic doesn't have a "none" type - we just don't pass tools
      // But if toolChoice is none with tools, we should not include tools
      return { type: 'auto' };
    default:
      return { type: 'auto' };
  }
}

/**
 * Convert Anthropic ToolUseBlock to MCP ToolUseContent.
 */
function anthropicToolUseToMcp(block: ToolUseBlock): ToolUseContent {
  return {
    type: 'tool_use',
    id: block.id,
    name: block.name,
    input: block.input as Record<string, unknown>,
  };
}

/**
 * Convert MCP ToolResultContent to Anthropic ToolResultBlockParam.
 * MCP uses camelCase, Anthropic uses snake_case.
 */
function mcpToolResultToAnthropic(result: ToolResultContent): ToolResultBlockParam {
  // MCP content is array of content blocks, Anthropic expects string or array
  let content: ToolResultBlockParam['content'];

  if (result.content && result.content.length > 0) {
    // Convert MCP content blocks to Anthropic format
    content = result.content.map(block => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: (block as TextContent).text };
      }
      // Handle image content if needed
      return { type: 'text' as const, text: JSON.stringify(block) };
    });
  }

  return {
    type: 'tool_result',
    tool_use_id: result.toolUseId,
    content,
    is_error: result.isError,
  };
}

/**
 * Map Anthropic stop_reason to MCP stopReason.
 */
function mapStopReason(anthropicReason: string | null): string | undefined {
  if (!anthropicReason) return undefined;

  const mapping: Record<string, string> = {
    'end_turn': 'endTurn',
    'max_tokens': 'maxTokens',
    'stop_sequence': 'stopSequence',
    'tool_use': 'toolUse',
  };

  return mapping[anthropicReason] ?? anthropicReason;
}

// ============================================================================
// SETUP FUNCTION
// ============================================================================

/**
 * Set up sampling capability on a client.
 *
 * The client must declare `sampling: { tools: {} }` in its capabilities
 * to receive tool-enabled sampling requests from servers.
 */
export function setupSampling(client: Client, config: SamplingConfig = {}): void {
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[Sampling] No API key - using mock handler');
    client.setRequestHandler(CreateMessageRequestSchema, createMockHandler());
    return;
  }

  const anthropic = new Anthropic({ apiKey });
  const model = config.model ?? 'claude-sonnet-4-20250514';
  const defaultMaxTokens = config.defaultMaxTokens ?? 1024;

  client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
    const { params } = request;

    // Log request info
    const hasTools = params.tools && params.tools.length > 0;
    console.log(`[Sampling] Server requested LLM completion${hasTools ? ` with ${params.tools!.length} tools` : ''}`);

    // Convert MCP messages to Anthropic format
    const messages: MessageParam[] = params.messages.map((msg: SamplingMessage) => ({
      role: msg.role as 'user' | 'assistant',
      content: formatMessageContent(msg.content),
    }));

    // Build Anthropic API request
    const apiRequest: Anthropic.MessageCreateParams = {
      model,
      max_tokens: params.maxTokens ?? defaultMaxTokens,
      messages,
      system: params.systemPrompt,
      temperature: params.temperature,
      stop_sequences: params.stopSequences,
    };

    // Add tools if provided (and toolChoice is not 'none')
    if (hasTools && params.toolChoice?.mode !== 'none') {
      apiRequest.tools = params.tools!.map(mcpToolToAnthropic);

      // Add tool_choice if provided
      if (params.toolChoice) {
        apiRequest.tool_choice = mcpToolChoiceToAnthropic(params.toolChoice);
      }
    }

    // Make API call
    const response = await anthropic.messages.create(apiRequest);

    // Handle tool use response
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content
        .filter((block): block is ToolUseBlock => block.type === 'tool_use')
        .map(anthropicToolUseToMcp);

      console.log(`[Sampling] LLM requested ${toolUseBlocks.length} tool(s): ${toolUseBlocks.map(t => t.name).join(', ')}`);

      const result: CreateMessageResultWithTools = {
        role: 'assistant',
        content: toolUseBlocks,
        model: response.model,
        stopReason: 'toolUse',
      };
      return result;
    }

    // Handle text response (single block for backwards compatibility)
    const textBlock = response.content.find(c => c.type === 'text');
    console.log(`[Sampling] LLM returned text response (stopReason: ${response.stop_reason})`);

    const result: CreateMessageResult = {
      role: 'assistant',
      content: {
        type: 'text',
        text: textBlock?.type === 'text' ? textBlock.text : '',
      },
      model: response.model,
      stopReason: mapStopReason(response.stop_reason),
    };
    return result;
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert MCP SamplingMessage content to Anthropic MessageParam content.
 * Handles text, image, tool_use, and tool_result content types.
 */
function formatMessageContent(content: SamplingMessage['content']): MessageParam['content'] {
  // Handle string shorthand
  if (typeof content === 'string') {
    return content;
  }

  // Handle single content block
  if (!Array.isArray(content)) {
    return [formatSingleBlock(content as SamplingContentBlock)];
  }

  // Handle array of content blocks
  return content.map(block => formatSingleBlock(block as SamplingContentBlock));
}

function formatSingleBlock(block: SamplingContentBlock): ContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: (block as TextContent).text };

    case 'image': {
      const imageBlock = block as ImageContent;
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageBlock.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: imageBlock.data,
        },
      };
    }

    case 'tool_use': {
      const toolUseBlock = block as ToolUseContent;
      return {
        type: 'tool_use',
        id: toolUseBlock.id,
        name: toolUseBlock.name,
        input: toolUseBlock.input,
      };
    }

    case 'tool_result':
      return mcpToolResultToAnthropic(block as ToolResultContent);

    default:
      // Fallback for unknown types
      return { type: 'text', text: JSON.stringify(block) };
  }
}

/**
 * Format content as string (for backwards compatibility and mock handler).
 */
function formatContentAsString(content: unknown): string {
  if (typeof content === 'string') return content;

  if (typeof content === 'object' && content !== null) {
    if ('type' in content && content.type === 'text' && 'text' in content) {
      return content.text as string;
    }
    if (Array.isArray(content)) {
      return content
        .filter(c => c.type === 'text' && 'text' in c)
        .map(c => c.text)
        .join('\n');
    }
  }

  return String(content);
}

function createMockHandler() {
  return async (request: { params: { messages: Array<{ content: unknown }>; tools?: Tool[] } }): Promise<SamplingResponse> => {
    console.log('[Sampling] Mock response (no API key)');

    // If tools are provided, simulate a tool use response
    if (request.params.tools && request.params.tools.length > 0) {
      const tool = request.params.tools[0];
      console.log(`[Sampling] Mock: Would use tool "${tool.name}"`);
      const response: CreateMessageResultWithTools = {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: `mock_${Date.now()}`,
          name: tool.name,
          input: {},
        }],
        model: 'mock-model',
        stopReason: 'toolUse',
      };
      return response;
    }

    const prompt = request.params.messages[0]
      ? formatContentAsString(request.params.messages[0].content)
      : 'unknown';

    return {
      role: 'assistant',
      content: { type: 'text', text: `[Mock] Received: "${prompt.substring(0, 50)}..."` },
      model: 'mock-model',
      stopReason: 'endTurn',
    };
  };
}
