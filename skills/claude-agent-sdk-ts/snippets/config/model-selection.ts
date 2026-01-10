/**
 * Claude Agent SDK - Model Selection
 *
 * Choose the right model for your task: opus, sonnet, or haiku.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Model comparison:
 *
 * | Model  | Best For                        | Speed  | Cost    | Capability |
 * |--------|--------------------------------|--------|---------|------------|
 * | opus   | Complex reasoning, nuanced     | Slower | Highest | Highest    |
 * | sonnet | Balanced tasks, most use cases | Medium | Medium  | High       |
 * | haiku  | Simple tasks, high throughput  | Fastest| Lowest  | Good       |
 */

/**
 * Example 1: Opus for complex reasoning
 *
 * Use for:
 * - Complex architectural decisions
 * - Nuanced code review
 * - Tasks requiring deep understanding
 */
const complexTask = query({
  prompt: `Review this architecture and suggest improvements for scalability,
           considering CAP theorem implications and eventual consistency patterns.`,
  options: {
    model: 'opus',
    maxTurns: 20,
  },
});

/**
 * Example 2: Sonnet for balanced tasks (recommended default)
 *
 * Use for:
 * - Most coding tasks
 * - Bug fixes
 * - Feature implementation
 * - General Q&A with tools
 */
const standardTask = query({
  prompt: 'Fix the failing unit tests in the auth module.',
  options: {
    model: 'sonnet', // Good default choice
    maxTurns: 20,
    allowedTools: ['Read', 'Edit', 'Bash'],
  },
});

/**
 * Example 3: Haiku for simple/fast tasks
 *
 * Use for:
 * - Simple transformations
 * - Quick questions
 * - High-throughput pipelines
 * - Cost-sensitive batch processing
 */
const simpleTask = query({
  prompt: 'Convert this JSON to a TypeScript interface: {"name": "string", "age": "number"}',
  options: {
    model: 'haiku',
    maxTurns: 5,
  },
});

/**
 * Example 4: Inherit model from parent (for subagents)
 *
 * In subagent definitions, use 'inherit' to use the parent's model.
 */
const subagentConfig = {
  model: 'inherit' as const, // Uses parent agent's model
};

/**
 * Example 5: Dynamic model selection based on task complexity
 */
function selectModel(taskComplexity: 'simple' | 'medium' | 'complex'): 'haiku' | 'sonnet' | 'opus' {
  switch (taskComplexity) {
    case 'simple':
      return 'haiku';
    case 'medium':
      return 'sonnet';
    case 'complex':
      return 'opus';
  }
}

async function runWithDynamicModel(prompt: string, complexity: 'simple' | 'medium' | 'complex') {
  const model = selectModel(complexity);
  console.log(`Using model: ${model}`);

  const q = query({
    prompt,
    options: { model },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log(text.text);
    }
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`Cost: $${msg.total_cost_usd?.toFixed(4)}`);
    }
  }
}

/**
 * Example 6: Cost-aware model selection
 */
interface TaskConfig {
  prompt: string;
  budgetCents: number;
}

function selectModelForBudget(config: TaskConfig): 'haiku' | 'sonnet' | 'opus' {
  // Rough cost estimates per 1K tokens (varies by actual usage)
  // These are illustrative - check current pricing
  if (config.budgetCents < 1) {
    return 'haiku';
  } else if (config.budgetCents < 5) {
    return 'sonnet';
  } else {
    return 'opus';
  }
}

async function main() {
  // Run the balanced task as demo
  for await (const msg of standardTask) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log(text.text);
    }
  }
}

main().catch(console.error);
