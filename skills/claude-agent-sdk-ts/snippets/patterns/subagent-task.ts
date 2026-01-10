/**
 * Claude Agent SDK - Subagent Task Pattern
 *
 * Using the Task tool for subagent orchestration.
 * Enables multi-agent systems with specialized agents.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Subagent definitions for programmatic configuration
 *
 * These can also be defined in .claude/agents/*.md files
 * when using settingSources: ['project', 'local']
 */
const subagents: Record<string, { description: string; tools: string[]; prompt: string }> = {
  researcher: {
    description: 'Research specialist for finding information online and in codebases',
    tools: ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'],
    prompt: `You are a research specialist. Your job is to find accurate, relevant information.

Always:
- Cite your sources
- Verify information from multiple sources when possible
- Be concise but thorough
- Highlight key findings`,
  },
  coder: {
    description: 'Software engineer for writing and modifying code',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
    prompt: `You are an expert software engineer. Your job is to write clean, maintainable code.

Always:
- Follow existing code patterns and conventions
- Write clear comments for complex logic
- Handle errors appropriately
- Consider edge cases`,
  },
  reviewer: {
    description: 'Code reviewer for quality assurance and best practices',
    tools: ['Read', 'Glob', 'Grep'],
    prompt: `You are a senior code reviewer. Your job is to ensure code quality.

Focus on:
- Code correctness and logic errors
- Security vulnerabilities
- Performance issues
- Maintainability and readability
- Test coverage

Provide specific, actionable feedback.`,
  },
  tester: {
    description: 'QA engineer for writing and running tests',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
    prompt: `You are a QA engineer. Your job is to ensure software quality through testing.

Always:
- Write comprehensive test cases
- Cover edge cases and error conditions
- Use appropriate testing frameworks
- Report test results clearly`,
  },
};

/**
 * Main orchestrator agent configuration
 *
 * The orchestrator can use the Task tool to delegate to subagents
 */
const orchestratorQuery = query({
  prompt: `You are a technical lead managing a software project.

           Analyze the current codebase, identify areas for improvement,
           then coordinate with your team to implement changes:

           1. Use the researcher to understand best practices
           2. Use the coder to implement improvements
           3. Use the reviewer to check the changes
           4. Use the tester to verify everything works

           Start by exploring the project structure.`,
  options: {
    model: 'opus', // Use most capable model for orchestration
    maxTurns: 50,
    cwd: process.cwd(),

    // Enable Task tool for subagent delegation
    allowedTools: ['Task', 'Read', 'Glob', 'Grep'],

    // Define subagents programmatically
    agents: subagents,

    systemPrompt: `You are a technical lead coordinating a team of specialized agents.

Your team:
- researcher: Finding information and best practices
- coder: Writing and modifying code
- reviewer: Reviewing code for quality
- tester: Writing and running tests

Delegate tasks appropriately using the Task tool. Provide clear, specific instructions to each agent.
Synthesize their outputs to make decisions and report progress.`,
  },
});

/**
 * Example: Workflow with specific task delegation
 */
async function runCoordinatedWorkflow() {
  console.log('Starting coordinated workflow...\n');

  const workflow = query({
    prompt: `Implement a new utility function that validates email addresses:

             1. Research email validation best practices and regex patterns
             2. Implement the validation function in src/utils/validators.ts
             3. Have the reviewer check the implementation
             4. Write tests for the new function

             Coordinate with your team to complete this task.`,
    options: {
      model: 'sonnet',
      maxTurns: 30,
      cwd: process.cwd(),
      allowedTools: ['Task', 'Read', 'Write', 'Edit', 'Glob', 'Bash'],
      agents: subagents,
    },
  });

  for await (const msg of workflow) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && 'text' in block) {
          console.log(block.text);
        }
        if (block.type === 'tool_use' && 'name' in block) {
          if (block.name === 'Task') {
            console.log(`\n[Delegating to subagent: ${block.input?.description || 'task'}]\n`);
          } else {
            console.log(`[Tool: ${block.name}]`);
          }
        }
      }
    }

    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`\n=== Workflow Complete ===`);
      console.log(`Total cost: $${msg.total_cost_usd?.toFixed(4)}`);
    }
  }
}

/**
 * Alternative: File-based subagent definitions
 *
 * Create files in .claude/agents/:
 *
 * .claude/agents/researcher.md:
 * ```
 * ---
 * name: researcher
 * description: Research specialist for finding information
 * tools: WebSearch, WebFetch, Read, Glob, Grep
 * ---
 *
 * You are a research specialist...
 * ```
 *
 * Then use with settingSources:
 */
const fileBasedAgentsQuery = query({
  prompt: 'Research and implement a feature...',
  options: {
    model: 'sonnet',
    cwd: process.cwd(),
    settingSources: ['project', 'local'], // Loads .claude/agents/*.md
    allowedTools: ['Task', 'Read', 'Write', 'Edit'],
    // agents: [] // Not needed - loaded from files
  },
});

/**
 * Main entry point
 */
async function main() {
  // Run the simple orchestrator
  for await (const msg of orchestratorQuery) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) {
        console.log(text.text);
      }
    }
  }
}

main().catch(console.error);

/**
 * Tips for effective subagent orchestration:
 *
 * 1. Clear specialization: Each agent should have a focused purpose
 * 2. Appropriate tools: Only give agents the tools they need
 * 3. Detailed prompts: Provide clear context when delegating
 * 4. Model selection: Use appropriate models (opus for complex, haiku for simple)
 * 5. Error handling: Plan for subagent failures
 * 6. Cost awareness: Track costs across all agents
 */
