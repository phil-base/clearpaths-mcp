import { ClearpathsClient } from '../clearpaths-client.js';

export async function listAreas(client: ClearpathsClient): Promise<string> {
  const areas = await client.listAreas();

  if (areas.length === 0) {
    return 'No areas defined in the current chapter.';
  }

  return areas.map((a) => `[${a.id}] ${a.description} (sort: ${a.sort_order})`).join('\n');
}

export async function listGoalTiers(client: ClearpathsClient): Promise<string> {
  const tiers = await client.listGoalTiers();

  if (tiers.length === 0) {
    return 'No goal tiers defined in the current chapter.';
  }

  return tiers
    .map((t) => `[${t.id}] ${t.description} (sort: ${t.sort_order})`)
    .join('\n');
}

export async function getSummary(client: ClearpathsClient): Promise<string> {
  const s = await client.getGoalSummary();

  return [
    `Goal Summary (Chapter ${s.chapter_id}):`,
    `  Total: ${s.total}`,
    `  Active: ${s.active}`,
    `  Completed: ${s.completed}`,
    `  Cancelled: ${s.cancelled}`,
    `  Deferred: ${s.deferred}`,
    `  Blocked: ${s.blocked}`,
  ].join('\n');
}
