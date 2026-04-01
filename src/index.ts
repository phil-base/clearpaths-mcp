#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ClearpathsClient } from './clearpaths-client.js';
import { listGoals } from './tools/list-goals.js';
import { getGoal, getGoalTree } from './tools/get-goal.js';
import {
  createGoal,
  updateGoal,
  deleteGoal,
  completeGoal,
  cancelGoal,
  deferGoal,
  undeferGoal,
  blockGoal,
  unblockGoal,
} from './tools/manage-goals.js';
import { addProgressNote, listProgressNotes } from './tools/comments.js';
import { listAreas, listGoalTiers, getSummary } from './tools/context.js';
import { whatCanIDo, reviewArea, breakDownGoal, whatIsStuck, chapterPulse, focusCheck } from './tools/workflows.js';

const { CLEARPATHS_URL, CLEARPATHS_TOKEN } = process.env;

if (!CLEARPATHS_URL || !CLEARPATHS_TOKEN) {
  console.error('[Clearpaths MCP] Missing required env vars: CLEARPATHS_URL, CLEARPATHS_TOKEN');
  process.exit(1);
}

const client = new ClearpathsClient(CLEARPATHS_URL, CLEARPATHS_TOKEN);

const server = new McpServer({
  name: 'clearpaths',
  version: '0.1.0',
});

// ─── Read tools ──────────────────────────────────────────────

server.tool(
  'list_goals',
  'List goals in the current chapter (paginated, 50 per page). Defaults to "actionable" — goals you can act on now (not blocked, not deferred, not completed). Use status "active" to include blocked/deferred, "all" to include everything.',
  {
    status: z.enum(['actionable', 'active', 'blocked', 'completed', 'cancelled', 'deferred', 'all']).optional().default('actionable').describe('Filter: actionable (default), active (includes blocked/deferred), blocked, completed, cancelled, deferred, all'),
    area_id: z.coerce.number().optional().describe('Filter by area ID'),
    goal_tier_id: z.coerce.number().optional().describe('Filter by goal tier ID'),
    parent_id: z.coerce.number().optional().describe('List children of a specific goal'),
    roots_only: z.boolean().optional().describe('Only return top-level goals (no parent)'),
    page: z.coerce.number().optional().describe('Page number (default 1)'),
    per_page: z.coerce.number().optional().describe('Results per page (default 50, max 100)'),
  },
  async (args) => {
    const text = await listGoals(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'get_goal',
  'Get detailed info about a single goal, including children, blockers, and progress notes.',
  {
    goal_id: z.coerce.number().describe('The goal ID'),
  },
  async (args) => {
    const text = await getGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'get_goal_tree',
  'Get a goal and its full hierarchy of descendants as a nested tree.',
  {
    goal_id: z.coerce.number().describe('The root goal ID'),
  },
  async (args) => {
    const text = await getGoalTree(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'get_summary',
  'Get a summary of goal counts in the current chapter: total, active, completed, cancelled, deferred, blocked.',
  {},
  async () => {
    const text = await getSummary(client);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'list_areas',
  'List all areas (life categories) in the current chapter.',
  {},
  async () => {
    const text = await listAreas(client);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'list_goal_tiers',
  'List all goal tiers (hierarchy levels like "7 Years", "1 Year", "1 Week") in the current chapter.',
  {},
  async () => {
    const text = await listGoalTiers(client);
    return { content: [{ type: 'text', text }] };
  },
);

// ─── Write tools ─────────────────────────────────────────────

server.tool(
  'create_goal',
  'Create a new goal. Provide either area_id (for a root goal) or parent_id (for a sub-goal). The tier must be lower than the parent\'s tier.',
  {
    title: z.string().max(128).describe('Goal title'),
    description: z.string().max(8192).optional().describe('Optional description'),
    area_id: z.coerce.number().optional().describe('Area ID (required for root goals, omit for sub-goals)'),
    goal_tier_id: z.coerce.number().describe('Goal tier ID — use list_goal_tiers to see available tiers'),
    parent_id: z.coerce.number().optional().describe('Parent goal ID (for sub-goals)'),
  },
  async (args) => {
    const text = await createGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'update_goal',
  'Update an existing goal\'s title, description, area, tier, or parent.',
  {
    goal_id: z.coerce.number().describe('The goal ID to update'),
    title: z.string().max(128).optional().describe('New title'),
    description: z.string().max(8192).optional().describe('New description'),
    area_id: z.coerce.number().optional().describe('New area ID'),
    goal_tier_id: z.coerce.number().optional().describe('New tier ID'),
    parent_id: z.coerce.number().optional().describe('New parent goal ID'),
  },
  async (args) => {
    const text = await updateGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'delete_goal',
  'Delete a goal and all its descendants. This is irreversible.',
  {
    goal_id: z.coerce.number().describe('The goal ID to delete'),
  },
  async (args) => {
    const text = await deleteGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'complete_goal',
  'Mark a goal as complete. All sub-goals must be completed or cancelled first. Optionally add a completion note.',
  {
    goal_id: z.coerce.number().describe('The goal ID to complete'),
    note: z.string().max(2000).optional().describe('Optional completion note'),
  },
  async (args) => {
    const text = await completeGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'cancel_goal',
  'Cancel a goal. All sub-goals must be completed or cancelled first. Optionally add a note.',
  {
    goal_id: z.coerce.number().describe('The goal ID to cancel'),
    note: z.string().max(2000).optional().describe('Optional cancellation note'),
  },
  async (args) => {
    const text = await cancelGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'defer_goal',
  'Defer a goal — hides it from execution views but keeps it in planning views.',
  {
    goal_id: z.coerce.number().describe('The goal ID to defer'),
    note: z.string().max(2000).optional().describe('Optional note explaining why'),
  },
  async (args) => {
    const text = await deferGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'undefer_goal',
  'Undefer a goal — bring it back to active status.',
  {
    goal_id: z.coerce.number().describe('The goal ID to undefer'),
  },
  async (args) => {
    const text = await undeferGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'block_goal',
  'Mark a goal as blocked by another goal. The blocker must be completed before the blocked goal can proceed.',
  {
    goal_id: z.coerce.number().describe('The goal that is blocked'),
    blocking_goal_id: z.coerce.number().describe('The goal that is blocking it'),
  },
  async (args) => {
    const text = await blockGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'unblock_goal',
  'Remove a blocking relationship between two goals.',
  {
    goal_id: z.coerce.number().describe('The blocked goal'),
    blocking_goal_id: z.coerce.number().describe('The blocker to remove'),
  },
  async (args) => {
    const text = await unblockGoal(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'add_progress_note',
  'Add a progress note (comment) to a goal. Progress notes track updates over time.',
  {
    goal_id: z.coerce.number().describe('The goal ID'),
    body: z.string().max(2000).describe('The note text'),
  },
  async (args) => {
    const text = await addProgressNote(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'list_progress_notes',
  'List all progress notes on a goal, newest first.',
  {
    goal_id: z.coerce.number().describe('The goal ID'),
  },
  async (args) => {
    const text = await listProgressNotes(client, args);
    return { content: [{ type: 'text', text }] };
  },
);

// ─── Workflow tools ──────────────────────────────────────────

server.tool(
  'what_can_i_do',
  'Show actionable leaf goals grouped by area — things you can do right now. These are unblocked, non-deferred goals with no active children. Start here when deciding what to work on.',
  {},
  async () => {
    const text = await whatCanIDo(client);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'review_area',
  'Review an area: goal tree with completion rollup per tier, stale goals flagged, recently completed shown. Use this for periodic area reviews.',
  {
    area_id: z.coerce.number().describe('Area ID — use list_areas to see available areas'),
  },
  async (args) => {
    const text = await reviewArea(client, args.area_id);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'break_down_goal',
  'Prepare to decompose a goal into sub-goals at the next tier level. Returns context and instructions — does NOT create goals. Ask the user to approve suggestions before creating.',
  {
    goal_id: z.coerce.number().describe('The goal to break down'),
  },
  async (args) => {
    const text = await breakDownGoal(client, args.goal_id);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'what_is_stuck',
  'Show blocked goals with their blocking chains, stale goals with no activity in 2+ weeks, and highest-impact unblockers. Use this to identify and resolve friction.',
  {},
  async () => {
    const text = await whatIsStuck(client);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'chapter_pulse',
  'Chapter-level progress report: completion stats by area and tier, recently completed goals, overall health. Use this to check if you\'re making progress in the current chapter.',
  {},
  async () => {
    const text = await chapterPulse(client);
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'focus_check',
  'Compare where your actionable goals sit against your chapter focus. Shows action distribution by area with a visual bar chart, empty areas, and reflection questions. Use this to detect drift.',
  {},
  async () => {
    const text = await focusCheck(client);
    return { content: [{ type: 'text', text }] };
  },
);

// ─── Resources ───────────────────────────────────────────────

server.resource('current-chapter', 'clearpaths://chapters/current', async (uri) => {
  const chapters = await client.listChapters();
  const current = chapters.find((c) => c.is_current);

  if (!current) {
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'No current chapter found.' }] };
  }

  const text = [
    `Current Chapter: ${current.title}`,
    current.focus ? `Focus: ${current.focus}` : null,
    `Started: ${current.started_at}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { contents: [{ uri: uri.href, mimeType: 'text/plain', text }] };
});

server.resource('blocked-goals', 'clearpaths://goals/blocked', async (uri) => {
  const result = await client.listGoals({ status: 'active', per_page: 100 });
  const blocked = result.data.filter((g) => g.is_blocked);

  if (blocked.length === 0) {
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'No blocked goals.' }] };
  }

  const lines = [`Blocked Goals (${blocked.length}):`];
  for (const g of blocked) {
    lines.push(`  [${g.id}] ${g.title} — area: ${g.effective_area?.description ?? '(none)'}`);
  }

  return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: lines.join('\n') }] };
});

server.resource('goal-summary', 'clearpaths://goals/summary', async (uri) => {
  const text = await getSummary(client);
  return { contents: [{ uri: uri.href, mimeType: 'text/plain', text }] };
});

// ─── Start ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Clearpaths MCP] Server running on stdio');
}

main().catch((err) => {
  console.error('[Clearpaths MCP] Fatal error:', err);
  process.exit(1);
});
