/**
 * Claude Agent SDK - File-based Subagent Definitions
 *
 * Define subagents in .claude/agents/*.md files for cleaner organization.
 * This is the recommended approach for production multi-agent systems.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * File-based subagents require:
 * 1. allowedTools includes 'Task'
 * 2. settingSources includes 'project' and/or 'local'
 * 3. Subagent definitions in .claude/agents/<name>.md
 *
 * Directory structure:
 * project/
 * ├── .claude/
 * │   ├── agents/
 * │   │   ├── financial-analyst.md
 * │   │   ├── recruiter.md
 * │   │   └── researcher.md
 * │   ├── settings.json          # Shared project settings
 * │   ├── settings.local.json    # Local overrides (gitignored)
 * │   └── CLAUDE.md              # Shared context for all agents
 * └── src/
 *     └── agent.ts
 */

/**
 * Subagent Definition Format (.claude/agents/financial-analyst.md):
 *
 * ```markdown
 * ---
 * name: financial-analyst
 * description: Financial analysis expert. Use for budget analysis,
 *              burn rate calculations, and investment decisions.
 * tools: Read, Bash, WebSearch
 * ---
 *
 * You are a senior financial analyst for TechStart Inc.
 *
 * ## Your Responsibilities
 * 1. Calculate and monitor burn rate, runway, and cash position
 * 2. Analyze unit economics (CAC, LTV, payback period)
 * 3. Create financial projections and scenarios
 * 4. Evaluate ROI on major decisions
 *
 * ## Available Data
 * - Financial data in `financial_data/` directory
 * - Company context in CLAUDE.md
 * - Python scripts in `scripts/` folder
 *
 * ## Output Guidelines
 * - Lead with the most critical insight
 * - Provide specific numbers and timeframes
 * - Include confidence levels for projections
 * - Recommend clear action items
 * ```
 */

/**
 * Main orchestrator agent using file-based subagents
 */
async function runOrchestrator() {
  const q = query({
    prompt: `Should we hire 5 engineers? Analyze the financial impact
             and hiring timeline. Delegate to specialists as needed.`,
    options: {
      model: 'opus',
      maxTurns: 50,
      cwd: process.cwd(),

      // Enable Task tool for subagent delegation
      allowedTools: ['Task', 'Read', 'Glob', 'Grep'],

      // CRITICAL: Load subagent definitions from filesystem
      // Without this, subagents won't be available!
      settingSources: ['project', 'local'],

      systemPrompt: `You are a Chief of Staff coordinating specialized agents.

Your team (defined in .claude/agents/):
- financial-analyst: Budget analysis, burn rate, runway calculations
- recruiter: Hiring decisions, compensation analysis, market rates
- researcher: Finding information and best practices

DELEGATION RULES:
- Delegate ALL financial questions to financial-analyst
- Delegate ALL hiring/HR questions to recruiter
- Delegate research tasks to researcher
- Synthesize results from multiple agents for cross-domain decisions
- Always include specific numbers and timelines in final recommendations`,
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && 'text' in block) {
          console.log(block.text);
        }
        if (block.type === 'tool_use' && 'name' in block) {
          if (block.name === 'Task') {
            const input = block.input as any;
            console.log(`\n[Delegating to: ${input?.subagent_type || 'subagent'}]`);
            console.log(`[Task: ${input?.description || 'task'}]\n`);
          }
        }
      }
    }

    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`\n--- Cost: $${msg.total_cost_usd?.toFixed(4)} ---`);
    }
  }
}

/**
 * CLAUDE.md - Shared Context
 *
 * Create .claude/CLAUDE.md for context shared across all agents:
 *
 * ```markdown
 * # TechStart Inc - Company Context
 *
 * ## Company Overview
 * B2B SaaS startup, Series A ($15M), 45 employees
 *
 * ## Current Metrics
 * - ARR: $3.2M
 * - Burn rate: $450K/month
 * - Runway: 18 months
 *
 * ## Key Priorities
 * 1. Reach $5M ARR by Q4
 * 2. Maintain 18+ months runway
 * 3. Build enterprise sales team
 * ```
 */

/**
 * Subagent Tracking with Hooks
 *
 * Track which subagent made each tool call using parent_tool_use_id:
 *
 * ```typescript
 * hooks: {
 *   PostToolUse: [{
 *     matcher: '.*',
 *     hooks: [async (input) => {
 *       const parentId = input.parent_tool_use_id;
 *       if (parentId) {
 *         console.log(`[Subagent ${parentId}] Tool: ${input.tool_name}`);
 *       }
 *       return { continue: true };
 *     }],
 *   }],
 * }
 * ```
 */

/**
 * settings.local.json - Hook Configuration
 *
 * .claude/settings.local.json (gitignored):
 * ```json
 * {
 *   "hooks": {
 *     "post_tool_use": ["hooks/audit-logger.py"]
 *   }
 * }
 * ```
 */

/**
 * Best Practices for File-based Subagents:
 *
 * 1. Clear Specialization
 *    - Each subagent should have ONE focused domain
 *    - Description should help main agent decide when to delegate
 *
 * 2. Appropriate Tool Access
 *    - Give subagents only the tools they need
 *    - Main agent handles file modifications when possible
 *
 * 3. Shared Context via CLAUDE.md
 *    - Company info, metrics, and context in CLAUDE.md
 *    - Role-specific instructions in each agent's .md file
 *
 * 4. Delegation Guidance
 *    - Main agent's system prompt should explicitly say when to delegate
 *    - Use phrases like "Delegate ALL financial questions to..."
 *
 * 5. Result Synthesis
 *    - Main agent should synthesize results from multiple subagents
 *    - Cross-domain decisions benefit from multiple perspectives
 */

// Run the orchestrator
runOrchestrator().catch(console.error);
