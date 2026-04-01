import { ClearpathsClient } from '../clearpaths-client.js';

export async function addProgressNote(
  client: ClearpathsClient,
  args: { goal_id: number; body: string },
): Promise<string> {
  const comment = await client.addComment(args.goal_id, args.body);
  return `Added progress note to goal [${args.goal_id}]: "${comment.body}"`;
}

export async function listProgressNotes(
  client: ClearpathsClient,
  args: { goal_id: number },
): Promise<string> {
  const comments = await client.listComments(args.goal_id);

  if (comments.length === 0) {
    return `No progress notes on goal [${args.goal_id}].`;
  }

  const lines = [`Progress notes for goal [${args.goal_id}] (${comments.length}):`];
  for (const c of comments) {
    lines.push(`  [${c.created_at}] ${c.body}`);
  }
  return lines.join('\n');
}
