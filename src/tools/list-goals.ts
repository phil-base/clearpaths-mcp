import { ClearpathsClient, Goal } from '../clearpaths-client.js';

export async function listGoals(
  client: ClearpathsClient,
  args: { status?: string; area_id?: number; goal_tier_id?: number; parent_id?: number; roots_only?: boolean },
): Promise<string> {
  const goals = await client.listGoals(args);

  if (goals.length === 0) {
    return 'No goals found matching the filters.';
  }

  return goals.map((g) => formatGoal(g)).join('\n\n');
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
