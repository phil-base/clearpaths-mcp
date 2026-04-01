import { ClearpathsClient, Goal } from '../clearpaths-client.js';

export async function getGoal(client: ClearpathsClient, args: { goal_id: number }): Promise<string> {
  const goal = await client.getGoal(args.goal_id);
  return formatGoalDetail(goal);
}

export async function getGoalTree(client: ClearpathsClient, args: { goal_id: number }): Promise<string> {
  const goal = await client.getGoalTree(args.goal_id);
  return formatTree(goal, 0);
}

function formatGoalDetail(g: Goal): string {
  const status = g.completed_at
    ? `✅ Completed (${g.completed_at})`
    : g.cancelled_at
      ? `❌ Cancelled (${g.cancelled_at})`
      : g.deferred
        ? '⏸️ Deferred'
        : g.is_blocked
          ? '🚫 Blocked'
          : '🟢 Active';

  const lines = [
    `# [${g.id}] ${g.title}`,
    `Status: ${status}`,
    `Tier: ${g.goal_tier?.description ?? '(unknown)'}`,
    `Area: ${g.effective_area?.description ?? g.area?.description ?? '(none)'}`,
  ];

  if (g.description) lines.push(`Description: ${g.description}`);
  if (g.parent_id) lines.push(`Parent: #${g.parent_id}`);

  if (g.children && g.children.length > 0) {
    lines.push(`\nChildren (${g.children.length}):`);
    for (const c of g.children) {
      const cs = c.completed_at ? '✅' : c.cancelled_at ? '❌' : c.deferred ? '⏸️' : c.is_blocked ? '🚫' : '🟢';
      lines.push(`  ${cs} [${c.id}] ${c.title}`);
    }
  }

  if (g.blocked_by && g.blocked_by.length > 0) {
    lines.push(`\nBlocked by:`);
    for (const b of g.blocked_by) {
      lines.push(`  [${b.id}] ${b.title}`);
    }
  }

  if (g.comments && g.comments.length > 0) {
    lines.push(`\nProgress notes (${g.comments.length}):`);
    for (const c of g.comments) {
      lines.push(`  [${c.created_at}] ${c.body}`);
    }
  }

  return lines.join('\n');
}

function formatTree(g: Goal, depth: number): string {
  const indent = '  '.repeat(depth);
  const status = g.completed_at ? '✅' : g.cancelled_at ? '❌' : g.deferred ? '⏸️' : g.is_blocked ? '🚫' : '🟢';
  let line = `${indent}${status} [${g.id}] ${g.title}`;

  if (g.goal_tier?.description) {
    line += ` (${g.goal_tier.description})`;
  }

  const lines = [line];

  if (g.children) {
    for (const child of g.children) {
      lines.push(formatTree(child, depth + 1));
    }
  }

  return lines.join('\n');
}
