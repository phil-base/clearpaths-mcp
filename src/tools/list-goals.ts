import { ClearpathsClient, Goal } from '../clearpaths-client.js';

export async function listGoals(
  client: ClearpathsClient,
  args: {
    status?: string;
    area_id?: number;
    goal_tier_id?: number;
    parent_id?: number;
    roots_only?: boolean;
    page?: number;
    per_page?: number;
  },
): Promise<string> {
  const result = await client.listGoals(args);

  if (result.data.length === 0) {
    return 'No goals found matching the filters.';
  }

  const lines = result.data.map((g) => formatGoal(g));
  const { current_page, last_page, total } = result.meta;

  lines.push(`\n--- Page ${current_page} of ${last_page} (${total} total) ---`);
  if (current_page < last_page) {
    lines.push(`Use page: ${current_page + 1} to see more.`);
  }

  return lines.join('\n\n');
}

export function formatGoal(g: Goal): string {
  const status = g.completed_at
    ? '✅ Completed'
    : g.cancelled_at
      ? '❌ Cancelled'
      : g.deferred
        ? '⏸️ Deferred'
        : g.is_blocked
          ? '🚫 Blocked'
          : '🟢 Active';

  const area = g.effective_area?.description ?? g.area?.description ?? '(no area)';
  const tier = g.goal_tier?.description ?? '(no tier)';

  let text = `[${g.id}] ${g.title} — ${status}\n  Tier: ${tier} | Area: ${area}`;

  if (g.description) {
    text += `\n  Description: ${g.description}`;
  }

  return text;
}
