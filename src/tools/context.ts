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

export async function createArea(
  client: ClearpathsClient,
  args: { description: string },
): Promise<string> {
  const area = await client.createArea(args.description);
  return `Created area [${area.id}] "${area.description}" (sort: ${area.sort_order})`;
}

export async function updateArea(
  client: ClearpathsClient,
  args: { area_id: number; description: string },
): Promise<string> {
  const area = await client.updateArea(args.area_id, args.description);
  return `Updated area [${area.id}] → "${area.description}"`;
}

export async function deleteArea(
  client: ClearpathsClient,
  args: { area_id: number },
): Promise<string> {
  await client.deleteArea(args.area_id);
  return `Deleted area [${args.area_id}]`;
}

export async function reorderAreas(
  client: ClearpathsClient,
  args: { area_ids: number[] },
): Promise<string> {
  await client.reorderAreas(args.area_ids);
  return `Reordered ${args.area_ids.length} areas.`;
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
