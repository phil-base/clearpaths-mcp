import { ClearpathsClient } from '../clearpaths-client.js';

export async function createGoal(
  client: ClearpathsClient,
  args: {
    title: string;
    description?: string;
    area_id?: number;
    goal_tier_id: number;
    parent_id?: number;
  },
): Promise<string> {
  const goal = await client.createGoal(args);
  return `Created goal [${goal.id}] "${goal.title}" (tier: ${goal.goal_tier?.description ?? goal.goal_tier_id}, area: ${goal.effective_area?.description ?? goal.area?.description ?? 'inherited'})`;
}

export async function updateGoal(
  client: ClearpathsClient,
  args: {
    goal_id: number;
    title?: string;
    description?: string;
    area_id?: number;
    goal_tier_id?: number;
    parent_id?: number;
  },
): Promise<string> {
  const { goal_id, ...data } = args;
  const goal = await client.updateGoal(goal_id, data);
  return `Updated goal [${goal.id}] "${goal.title}"`;
}

export async function deleteGoal(client: ClearpathsClient, args: { goal_id: number }): Promise<string> {
  await client.deleteGoal(args.goal_id);
  return `Deleted goal [${args.goal_id}] and all its descendants.`;
}

export async function completeGoal(
  client: ClearpathsClient,
  args: { goal_id: number; note?: string },
): Promise<string> {
  const goal = await client.completeGoal(args.goal_id, args.note);
  return `Completed goal [${goal.id}] "${goal.title}"${args.note ? ` with note: "${args.note}"` : ''}`;
}

export async function cancelGoal(
  client: ClearpathsClient,
  args: { goal_id: number; note?: string },
): Promise<string> {
  const goal = await client.cancelGoal(args.goal_id, args.note);
  return `Cancelled goal [${goal.id}] "${goal.title}"${args.note ? ` with note: "${args.note}"` : ''}`;
}

export async function deferGoal(
  client: ClearpathsClient,
  args: { goal_id: number; note?: string },
): Promise<string> {
  const goal = await client.deferGoal(args.goal_id, args.note);
  return `Deferred goal [${goal.id}] "${goal.title}"`;
}

export async function undeferGoal(client: ClearpathsClient, args: { goal_id: number }): Promise<string> {
  const goal = await client.undeferGoal(args.goal_id);
  return `Undeferred goal [${goal.id}] "${goal.title}" — it's now active again.`;
}

export async function blockGoal(
  client: ClearpathsClient,
  args: { goal_id: number; blocking_goal_id: number },
): Promise<string> {
  await client.blockGoal(args.goal_id, args.blocking_goal_id);
  return `Goal [${args.goal_id}] is now blocked by goal [${args.blocking_goal_id}].`;
}

export async function unblockGoal(
  client: ClearpathsClient,
  args: { goal_id: number; blocking_goal_id: number },
): Promise<string> {
  await client.unblockGoal(args.goal_id, args.blocking_goal_id);
  return `Removed block: goal [${args.goal_id}] is no longer blocked by [${args.blocking_goal_id}].`;
}
