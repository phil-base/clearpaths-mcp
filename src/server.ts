import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ClearpathsClient } from './clearpaths-client.js';
import { listGoals, listTopLevelGoals } from './tools/list-goals.js';
import { getGoal, getGoalTree } from './tools/get-goal.js';
import {
  createGoal,
  updateGoal,
  reorderChildren,
  deleteGoal,
  completeGoal,
  cancelGoal,
  deferGoal,
  undeferGoal,
  blockGoal,
  unblockGoal,
} from './tools/manage-goals.js';
import { addProgressNote, listProgressNotes } from './tools/comments.js';
import { listAreas, createArea, updateArea, deleteArea, reorderAreas, listGoalTiers, getSummary } from './tools/context.js';
import { whatCanIDo, needsPlanning, needsExecution, reviewArea, breakDownGoal, whatIsStuck, chapterPulse, focusCheck } from './tools/workflows.js';

const VERSION = '0.1.2';

const CLEARPATHS_PHILOSOPHY = {
  principle: 'Plan maximally, execute minimally.',
  goal_tree: [
    'You are building a complete goal tree. A complete goal tree has all goals broken down into sub-goals that are sufficient to achieve the parent goal, iterated down the tree until all goals are specified for today (the lowest tier).',
    'One exception to completeness: a goal may be too uncertain to plan now — it may depend on a prior goal completing, on research, or simply be too far in the future. Leave those un-decomposed.',
  ],
  sequencing: [
    'Strong bias to sequential goals: only one sub-goal is active at a time. Disable sequential on a parent only when all sub-goals genuinely need to be active in parallel.',
    'Sub-goals must be ordered correctly — sequence matters.',
  ],
  titles_and_descriptions: [
    'Goal titles must be as descriptive as possible — they appear outside the context of their goal tree.',
    'Add full descriptions. Goals should be actionable, and the context that created the goal tree should be present inside the goal tree itself.',
  ],
  long_running_work: 'For long-running goals, follow the pattern: start (do once, e.g. "write 500 words"), draft complete, review draft, publish.',
  recurring_work: 'Where something needs to repeat, the goal is to create a habit (e.g. "write 500 words per day").',
  goal_tiers: ['3 years', '6 months', '1 month', '1 week', 'today'],
} as const;

/**
 * Create an McpServer with all tools and resources registered,
 * bound to the given ClearpathsClient.
 */
export function createServer(client: ClearpathsClient): McpServer {
  const server = new McpServer({
    name: 'clearpaths',
    version: VERSION,
  });

  // ─── Read tools ──────────────────────────────────────────────

  server.tool(
    'list_top_level_goals',
    'List all top-level (root) goals grouped by area. Use this as the entry point for navigating the full goal hierarchy — then drill into individual trees with get_goal_tree.',
    {
      status: z.enum(['active', 'completed', 'cancelled', 'deferred', 'all']).optional().default('all').describe('Filter by status (default: all)'),
    },
    async (args) => {
      const text = await listTopLevelGoals(client, args);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'list_goals',
    'List goals in the current chapter (paginated, 50 per page). Defaults to "actionable" — goals you can act on now (not blocked, not deferred, not completed). Use status "active" to include blocked/deferred, "all" to include everything.',
    {
      status: z.enum(['actionable', 'active', 'blocked', 'completed', 'cancelled', 'deferred', 'all']).optional().default('actionable').describe('Filter: actionable (default), active (includes blocked/deferred), blocked, completed, cancelled, deferred, all'),
      area_id: z.coerce.number().optional().describe('Filter by area ID'),
      goal_tier_id: z.coerce.number().optional().describe('Filter by goal tier ID'),
      parent_id: z.coerce.number().optional().describe('List children of a specific goal'),
      roots_only: z.boolean().optional().describe('Only return top-level goals (no parent)'),
      search: z.string().optional().describe('Search goals by title (partial match)'),
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

  server.tool(
    'create_area',
    'Create a new area (life category) in the current chapter.',
    {
      description: z.string().max(255).describe('Area name'),
    },
    async (args) => {
      const text = await createArea(client, args);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'update_area',
    'Rename an existing area.',
    {
      area_id: z.coerce.number().describe('Area ID — use list_areas to see available areas'),
      description: z.string().max(255).describe('New area name'),
    },
    async (args) => {
      const text = await updateArea(client, args);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'delete_area',
    'Delete an area. Only works if no goals are assigned to it.',
    {
      area_id: z.coerce.number().describe('Area ID to delete'),
    },
    async (args) => {
      const text = await deleteArea(client, args);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'reorder_areas',
    'Reorder areas by providing area IDs in the desired order.',
    {
      area_ids: z.array(z.coerce.number()).describe('Array of area IDs in desired order'),
    },
    async (args) => {
      const text = await reorderAreas(client, args);
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
    'Update an existing goal\'s title, description, area, tier, parent, sort order, or sequential_children flag.',
    {
      goal_id: z.coerce.number().describe('The goal ID to update'),
      title: z.string().max(128).optional().describe('New title'),
      description: z.string().max(8192).optional().describe('New description'),
      area_id: z.coerce.number().optional().describe('New area ID'),
      goal_tier_id: z.coerce.number().optional().describe('New tier ID'),
      parent_id: z.coerce.number().optional().describe('New parent goal ID'),
      sort_order: z.coerce.number().optional().describe('Position among siblings (1-based)'),
      sequential_children: z.boolean().optional().describe('Whether children must be completed in order'),
    },
    async (args) => {
      const text = await updateGoal(client, args);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'reorder_children',
    'Set the order of sub-goals under a parent by providing the full ordered list of child goal IDs. The first ID becomes sort_order 1, second becomes 2, etc.',
    {
      parent_id: z.coerce.number().describe('The parent goal ID'),
      goal_ids: z.array(z.coerce.number()).describe('Child goal IDs in the desired order'),
    },
    async (args) => {
      const text = await reorderChildren(client, args);
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
    'needs_planning',
    'Goals that need to be broken down further — active leaf goals NOT at the lowest tier. These need decomposition before they\'re actionable. Use break_down_goal on each one.',
    {},
    async () => {
      const text = await needsPlanning(client);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'needs_execution',
    'Goals ready to do right now — active leaf goals AT the lowest tier (e.g. daily/weekly actions). Complete them with complete_goal.',
    {},
    async () => {
      const text = await needsExecution(client);
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

  server.resource('ai-context', 'clearpaths://context', async (uri) => {
    const data = await client.getContext();
    const payload = {
      philosophy: CLEARPATHS_PHILOSOPHY,
      ...(typeof data === 'object' && data !== null ? data : { data }),
    };
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(payload, null, 2) }] };
  });

  return server;
}
