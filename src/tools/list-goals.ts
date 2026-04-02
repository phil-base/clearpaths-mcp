import { ClearpathsClient, Goal, Area } from '../clearpaths-client.js';

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

export async function listTopLevelGoals(
  client: ClearpathsClient,
  args: { status?: string },
): Promise<string> {
  const [goals, areas] = await Promise.all([
    client.listAllGoals({ roots_only: true, status: args.status ?? 'all' }),
    client.listAreas(),
  ]);

  if (goals.length === 0) {
    return 'No top-level goals found.';
  }

  const areaMap = new Map<number, Area>(areas.map((a) => [a.id, a]));
  const grouped = new Map<string, Goal[]>();

  for (const g of goals) {
    const areaName = g.effective_area?.description ?? g.area?.description
      ?? (g.effective_area_id != null ? areaMap.get(g.effective_area_id)?.description : undefined)
      ?? '(no area)';
    if (!grouped.has(areaName)) grouped.set(areaName, []);
    grouped.get(areaName)!.push(g);
  }

  const lines: string[] = [`Top-level goals (${goals.length} total):\n`];

  for (const [areaName, areaGoals] of grouped) {
    lines.push(`## ${areaName}`);
    for (const g of areaGoals) {
      const status = g.completed_at ? '✅' : g.cancelled_at ? '❌' : g.deferred ? '⏸️' : g.is_blocked ? '🚫' : '🟢';
      const tier = g.goal_tier?.description ? ` (${g.goal_tier.description})` : '';
      lines.push(`  ${status} [${g.id}] ${g.title}${tier}`);
    }
    lines.push('');
  }

  return lines.join('\n');
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
