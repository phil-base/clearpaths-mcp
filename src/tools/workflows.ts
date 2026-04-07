import { ClearpathsClient, Goal, Area, GoalTier } from '../clearpaths-client.js';

/**
 * what_can_i_do — Actionable leaf goals grouped by area.
 * Philosophy: Act bottom-up. Show what's unblocked and ready.
 */
export async function whatCanIDo(client: ClearpathsClient): Promise<string> {
  const [goals, areas, tiers] = await Promise.all([
    client.listAllGoals({ status: 'actionable' }),
    client.listAreas(),
    client.listGoalTiers(),
  ]);

  // Find leaf goals — goals that have no children in the active set
  const parentIds = new Set(goals.filter((g) => g.parent_id).map((g) => g.parent_id));
  const leaves = goals.filter((g) => !parentIds.has(g.id));

  if (leaves.length === 0) {
    return 'Nothing actionable right now. Everything is either blocked, deferred, or completed.';
  }

  // Group by area
  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const grouped = new Map<string, Goal[]>();

  for (const g of leaves) {
    const areaName = areaMap.get(g.effective_area_id ?? 0)?.description ?? '(no area)';
    if (!grouped.has(areaName)) grouped.set(areaName, []);
    grouped.get(areaName)!.push(g);
  }

  const lines: string[] = [`## What you can do right now (${leaves.length} actions)\n`];

  for (const [area, areaGoals] of grouped) {
    lines.push(`### ${area} (${areaGoals.length})`);
    for (const g of areaGoals) {
      const tier = tierMap.get(g.goal_tier_id)?.description ?? '';
      lines.push(`  [${g.id}] ${g.title} (${tier})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * needs_planning — Active leaf goals that are NOT at the lowest tier.
 * These need to be broken down into more specific sub-goals before they're actionable.
 * Mirrors the "planning" mode of the Clearpaths actions view.
 */
export async function needsPlanning(client: ClearpathsClient): Promise<string> {
  const [goals, areas, tiers] = await Promise.all([
    client.listAllGoals({ status: 'actionable' }),
    client.listAreas(),
    client.listGoalTiers(),
  ]);

  const tiersSorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
  const lowestTier = tiersSorted[tiersSorted.length - 1];
  if (!lowestTier) return 'No goal tiers configured.';

  // Find leaf goals — goals that have no children in the active set
  const parentIds = new Set(goals.filter((g) => g.parent_id).map((g) => g.parent_id));
  const leaves = goals.filter((g) => !parentIds.has(g.id));

  // Planning = leaves NOT at the lowest tier
  const planning = leaves.filter((g) => g.goal_tier_id !== lowestTier.id);

  if (planning.length === 0) {
    return 'Nothing needs planning — all leaf goals are already at the execution level.';
  }

  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const grouped = new Map<string, Goal[]>();

  for (const g of planning) {
    const areaName = areaMap.get(g.effective_area_id ?? 0)?.description ?? '(no area)';
    if (!grouped.has(areaName)) grouped.set(areaName, []);
    grouped.get(areaName)!.push(g);
  }

  const lines: string[] = [`## Needs Planning (${planning.length} goals)\n`];
  lines.push(`These goals don't break down to ${lowestTier.description}-level actions yet. Use break_down_goal to decompose them.\n`);

  for (const [area, areaGoals] of grouped) {
    lines.push(`### ${area} (${areaGoals.length})`);
    for (const g of areaGoals) {
      const tier = tierMap.get(g.goal_tier_id)?.description ?? '';
      lines.push(`  [${g.id}] ${g.title} (${tier})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * needs_execution — Active leaf goals AT the lowest tier.
 * These are ready to do — no further breakdown needed.
 * Mirrors the "execution" mode of the Clearpaths actions view.
 */
export async function needsExecution(client: ClearpathsClient): Promise<string> {
  const [goals, areas, tiers] = await Promise.all([
    client.listAllGoals({ status: 'actionable' }),
    client.listAreas(),
    client.listGoalTiers(),
  ]);

  const tiersSorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
  const lowestTier = tiersSorted[tiersSorted.length - 1];
  if (!lowestTier) return 'No goal tiers configured.';

  // Find leaf goals — goals that have no children in the active set
  const parentIds = new Set(goals.filter((g) => g.parent_id).map((g) => g.parent_id));
  const leaves = goals.filter((g) => !parentIds.has(g.id));

  // Execution = leaves AT the lowest tier
  const execution = leaves.filter((g) => g.goal_tier_id === lowestTier.id);

  if (execution.length === 0) {
    return `No ${lowestTier.description}-level goals ready for execution. Use needs_planning to see what needs to be broken down.`;
  }

  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const grouped = new Map<string, Goal[]>();

  for (const g of execution) {
    const areaName = areaMap.get(g.effective_area_id ?? 0)?.description ?? '(no area)';
    if (!grouped.has(areaName)) grouped.set(areaName, []);
    grouped.get(areaName)!.push(g);
  }

  const lines: string[] = [`## Needs Execution (${execution.length} ${lowestTier.description}-level actions)\n`];
  lines.push(`These are ready to do right now. Complete them with complete_goal.\n`);

  for (const [area, areaGoals] of grouped) {
    lines.push(`### ${area} (${areaGoals.length})`);
    for (const g of areaGoals) {
      lines.push(`  [${g.id}] ${g.title}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * review_area — Full tree view of an area with completion rollup.
 * Philosophy: Reviews maintain the system. Structural progress at a glance.
 */
export async function reviewArea(client: ClearpathsClient, areaId: number): Promise<string> {
  const [allGoals, areas, tiers] = await Promise.all([
    client.listAllGoals({ status: 'all', area_id: areaId }),
    client.listAreas(),
    client.listGoalTiers(),
  ]);

  const area = areas.find((a) => a.id === areaId);
  if (!area) return `Area ${areaId} not found.`;

  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const tiersSorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);

  // Completion stats per tier
  const tierStats = new Map<number, { total: number; completed: number; cancelled: number; blocked: number; deferred: number; active: number }>();
  for (const t of tiers) {
    tierStats.set(t.id, { total: 0, completed: 0, cancelled: 0, blocked: 0, deferred: 0, active: 0 });
  }

  const now = Date.now();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const stale: Goal[] = [];

  for (const g of allGoals) {
    const s = tierStats.get(g.goal_tier_id);
    if (!s) continue;
    s.total++;
    if (g.completed_at) s.completed++;
    else if (g.cancelled_at) s.cancelled++;
    else if (g.deferred) s.deferred++;
    else if (g.is_blocked) s.blocked++;
    else {
      s.active++;
      // Check for staleness
      const lastUpdate = new Date(g.updated_at).getTime();
      if (now - lastUpdate > twoWeeksMs) {
        stale.push(g);
      }
    }
  }

  // Build root goals (no parent, or parent outside this area)
  const goalIds = new Set(allGoals.map((g) => g.id));
  const roots = allGoals.filter((g) => !g.parent_id || !goalIds.has(g.parent_id));
  const childMap = new Map<number, Goal[]>();
  for (const g of allGoals) {
    if (g.parent_id && goalIds.has(g.parent_id)) {
      if (!childMap.has(g.parent_id)) childMap.set(g.parent_id, []);
      childMap.get(g.parent_id)!.push(g);
    }
  }

  const lines: string[] = [`## Area Review: ${area.description}\n`];

  // Tier breakdown
  lines.push('### Progress by Tier\n');
  for (const t of tiersSorted) {
    const s = tierStats.get(t.id);
    if (!s || s.total === 0) continue;
    const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    lines.push(`  ${t.description}: ${s.completed}/${s.total} complete (${pct}%) — ${s.active} active, ${s.blocked} blocked, ${s.deferred} deferred`);
  }

  // Goal tree
  lines.push('\n### Goal Tree\n');
  for (const root of roots.filter((g) => !g.completed_at && !g.cancelled_at)) {
    formatTreeNode(root, 0, childMap, tierMap, lines);
  }

  // Stale goals
  if (stale.length > 0) {
    lines.push(`\n### ⚠️ Stale Goals (no activity in 2+ weeks)\n`);
    for (const g of stale) {
      const daysSince = Math.round((now - new Date(g.updated_at).getTime()) / (24 * 60 * 60 * 1000));
      lines.push(`  [${g.id}] ${g.title} — ${daysSince} days since last update`);
    }
  }

  // Completed recently
  const completed = allGoals.filter((g) => g.completed_at);
  if (completed.length > 0) {
    lines.push(`\n### ✅ Completed (${completed.length})\n`);
    for (const g of completed.slice(0, 10)) {
      lines.push(`  [${g.id}] ${g.title} (${g.completed_at})`);
    }
    if (completed.length > 10) lines.push(`  ... and ${completed.length - 10} more`);
  }

  return lines.join('\n');
}

function formatTreeNode(g: Goal, depth: number, childMap: Map<number, Goal[]>, tierMap: Map<number, { description: string }>, lines: string[]): void {
  const indent = '  '.repeat(depth);
  const status = g.deferred ? '⏸️' : g.is_blocked ? '🚫' : '🟢';
  const tier = tierMap.get(g.goal_tier_id)?.description ?? '';
  lines.push(`${indent}${status} [${g.id}] ${g.title} (${tier})`);

  const children = childMap.get(g.id) ?? [];
  for (const c of children.filter((c) => !c.completed_at && !c.cancelled_at)) {
    formatTreeNode(c, depth + 1, childMap, tierMap, lines);
  }
}

/**
 * break_down_goal — Suggest sub-goals for a goal at the next tier level.
 * Philosophy: Think top-down. Decompose before you act.
 * Returns suggestions as text — the AI should ask the user before creating.
 */
export async function breakDownGoal(client: ClearpathsClient, goalId: number): Promise<string> {
  const [goal, tiers, areas] = await Promise.all([
    client.getGoal(goalId),
    client.listGoalTiers(),
    client.listAreas(),
  ]);

  const tiersSorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
  const currentTier = tiersSorted.find((t) => t.id === goal.goal_tier_id);
  if (!currentTier) return `Could not find tier for goal [${goalId}].`;

  const nextTier = tiersSorted.find((t) => t.sort_order > currentTier.sort_order);
  if (!nextTier) return `Goal [${goalId}] "${goal.title}" is already at the lowest tier (${currentTier.description}). It's an action — do it, don't decompose it further.`;

  const area = areas.find((a) => a.id === (goal.effective_area_id ?? goal.area_id));
  const existingChildren = goal.children ?? [];
  const activeChildren = existingChildren.filter((c) => !c.completed_at && !c.cancelled_at);

  const lines: string[] = [
    `## Break Down: [${goal.id}] ${goal.title}`,
    `Current tier: ${currentTier.description}`,
    `Next tier: ${nextTier.description} (id: ${nextTier.id})`,
    `Area: ${area?.description ?? '(none)'}`,
    '',
  ];

  if (activeChildren.length > 0) {
    lines.push(`### Existing sub-goals (${activeChildren.length}):\n`);
    for (const c of activeChildren) {
      const ct = tiersSorted.find((t) => t.id === c.goal_tier_id);
      lines.push(`  [${c.id}] ${c.title} (${ct?.description ?? '?'})`);
    }
    lines.push('');
  }

  lines.push(`### Context for AI`);
  lines.push(`To create sub-goals, use create_goal with:`);
  lines.push(`  - parent_id: ${goal.id}`);
  lines.push(`  - goal_tier_id: ${nextTier.id} (${nextTier.description})`);
  lines.push(`  - No area_id needed (inherits from parent)`);
  lines.push('');
  lines.push(`### Instructions`);
  lines.push(`Suggest 3-7 sub-goals that break "${goal.title}" into concrete ${nextTier.description}-level outcomes.`);
  lines.push(`Each sub-goal should be a verifiable outcome, not an activity.`);
  lines.push(`Ask the user to approve, edit, or reject each suggestion before creating.`);

  if (goal.description) {
    lines.push(`\n### Goal description\n${goal.description}`);
  }

  if (goal.comments && goal.comments.length > 0) {
    lines.push(`\n### Recent progress notes`);
    for (const c of goal.comments.slice(0, 5)) {
      lines.push(`  [${c.created_at}] ${c.body}`);
    }
  }

  return lines.join('\n');
}

/**
 * what_is_stuck — Blocked goals with blocking chains, plus stale goals.
 * Philosophy: Surface friction. If blocked for weeks, rethink.
 */
export async function whatIsStuck(client: ClearpathsClient): Promise<string> {
  const [blocked, allActive, areas] = await Promise.all([
    client.listAllGoals({ status: 'blocked' }),
    client.listAllGoals({ status: 'active' }),
    client.listAreas(),
  ]);

  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const goalMap = new Map(allActive.map((g) => [g.id, g]));

  const lines: string[] = [];

  // Blocked goals grouped by area
  if (blocked.length > 0) {
    lines.push(`## 🚫 Blocked Goals (${blocked.length})\n`);

    const groupedByArea = new Map<string, Goal[]>();
    for (const g of blocked) {
      const area = areaMap.get(g.effective_area_id ?? 0)?.description ?? '(no area)';
      if (!groupedByArea.has(area)) groupedByArea.set(area, []);
      groupedByArea.get(area)!.push(g);
    }

    for (const [area, goals] of groupedByArea) {
      lines.push(`### ${area}`);
      for (const g of goals) {
        lines.push(`  [${g.id}] ${g.title}`);
        // Show what's blocking it
        if (g.blocked_by && g.blocked_by.length > 0) {
          for (const b of g.blocked_by) {
            const blockerStatus = b.completed_at ? '✅ done' : b.is_blocked ? '🚫 also blocked' : '🟢 actionable';
            lines.push(`    ← blocked by [${b.id}] ${b.title} (${blockerStatus})`);
          }
        }
      }
      lines.push('');
    }
  } else {
    lines.push('## 🚫 No blocked goals!\n');
  }

  // Stale goals (active, not blocked, not deferred, no update in 2+ weeks)
  const now = Date.now();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const stale = allActive.filter((g) => {
    if (g.completed_at || g.cancelled_at || g.deferred || g.is_blocked) return false;
    return now - new Date(g.updated_at).getTime() > twoWeeksMs;
  });

  if (stale.length > 0) {
    lines.push(`## ⚠️ Stale Goals — active but untouched for 2+ weeks (${stale.length})\n`);
    // Sort by staleness
    stale.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
    for (const g of stale.slice(0, 20)) {
      const days = Math.round((now - new Date(g.updated_at).getTime()) / (24 * 60 * 60 * 1000));
      const area = areaMap.get(g.effective_area_id ?? 0)?.description ?? '';
      lines.push(`  [${g.id}] ${g.title} — ${days} days stale (${area})`);
    }
    if (stale.length > 20) lines.push(`  ... and ${stale.length - 20} more`);
  } else {
    lines.push('## ⚠️ No stale goals — everything active has been touched recently.');
  }

  // Highest-impact unblockers: goals that are blocking the most other goals
  const blockerCounts = new Map<number, number>();
  for (const g of blocked) {
    if (g.blocked_by) {
      for (const b of g.blocked_by) {
        if (!b.completed_at && !b.cancelled_at) {
          blockerCounts.set(b.id, (blockerCounts.get(b.id) ?? 0) + 1);
        }
      }
    }
  }

  if (blockerCounts.size > 0) {
    const sorted = [...blockerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push(`\n## 🔑 Highest-Impact Unblockers\n`);
    lines.push(`Completing these would unblock the most goals:\n`);
    for (const [id, count] of sorted) {
      const g = goalMap.get(id);
      const status = g?.is_blocked ? '🚫 also blocked' : '🟢 actionable';
      lines.push(`  [${id}] ${g?.title ?? '(unknown)'} — unblocks ${count} goal${count > 1 ? 's' : ''} (${status})`);
    }
  }

  return lines.join('\n');
}

/**
 * chapter_pulse — Completion stats by area and tier, recent movement.
 * Philosophy: Chapters bound your horizon. Am I making progress?
 */
export async function chapterPulse(client: ClearpathsClient): Promise<string> {
  const [allGoals, areas, tiers, chapters, summary] = await Promise.all([
    client.listAllGoals({ status: 'all' }),
    client.listAreas(),
    client.listGoalTiers(),
    client.listChapters(),
    client.getGoalSummary(),
  ]);

  const current = chapters.find((c) => c.is_current);
  const tiersSorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
  const areasSorted = [...areas].sort((a, b) => a.sort_order - b.sort_order);

  const lines: string[] = [
    `## Chapter Pulse: ${current?.title ?? 'Unknown'}`,
    current?.focus ? `Focus: ${current.focus}` : '',
    '',
    `**${summary.total} goals** — ${summary.completed} completed, ${summary.active} active, ${summary.blocked} blocked, ${summary.deferred} deferred`,
    '',
  ];

  // Per-area completion
  lines.push('### By Area\n');
  for (const area of areasSorted) {
    const areaGoals = allGoals.filter((g) => (g.effective_area_id ?? g.area_id) === area.id);
    if (areaGoals.length === 0) continue;
    const completed = areaGoals.filter((g) => g.completed_at).length;
    const active = areaGoals.filter((g) => !g.completed_at && !g.cancelled_at).length;
    const blocked = areaGoals.filter((g) => !g.completed_at && !g.cancelled_at && g.is_blocked).length;
    const pct = Math.round((completed / areaGoals.length) * 100);
    lines.push(`  ${area.description}: ${completed}/${areaGoals.length} (${pct}%) — ${active} active, ${blocked} blocked`);
  }

  // Per-tier completion
  lines.push('\n### By Tier\n');
  for (const tier of tiersSorted) {
    const tierGoals = allGoals.filter((g) => g.goal_tier_id === tier.id);
    if (tierGoals.length === 0) continue;
    const completed = tierGoals.filter((g) => g.completed_at).length;
    const total = tierGoals.length;
    const pct = Math.round((completed / total) * 100);
    lines.push(`  ${tier.description}: ${completed}/${total} (${pct}%)`);
  }

  // Recently completed (last 7 days)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentlyCompleted = allGoals
    .filter((g) => g.completed_at && g.completed_at >= oneWeekAgo)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!));

  if (recentlyCompleted.length > 0) {
    lines.push(`\n### ✅ Completed This Week (${recentlyCompleted.length})\n`);
    for (const g of recentlyCompleted) {
      const area = areas.find((a) => a.id === (g.effective_area_id ?? g.area_id));
      lines.push(`  [${g.id}] ${g.title} (${area?.description ?? ''})`);
    }
  } else {
    lines.push('\n### ✅ Nothing completed this week.');
  }

  return lines.join('\n');
}

/**
 * focus_check — Compare actionable work against chapter focus.
 * Philosophy: Chapters have a focus. Detect drift.
 */
export async function focusCheck(client: ClearpathsClient): Promise<string> {
  const [actionable, areas, tiers, chapters] = await Promise.all([
    client.listAllGoals({ status: 'actionable' }),
    client.listAreas(),
    client.listGoalTiers(),
    client.listChapters(),
  ]);

  const current = chapters.find((c) => c.is_current);
  const areasSorted = [...areas].sort((a, b) => a.sort_order - b.sort_order);
  const tierMap = new Map(tiers.map((t) => [t.id, t]));

  // Find leaf goals (actionable things you'd actually work on)
  const parentIds = new Set(actionable.filter((g) => g.parent_id).map((g) => g.parent_id));
  const leaves = actionable.filter((g) => !parentIds.has(g.id));

  // Count leaves per area
  const areaCounts = new Map<number, number>();
  for (const g of leaves) {
    const aid = g.effective_area_id ?? 0;
    areaCounts.set(aid, (areaCounts.get(aid) ?? 0) + 1);
  }

  const totalLeaves = leaves.length;

  const lines: string[] = [
    `## Focus Check: ${current?.title ?? 'Unknown'}`,
    current?.focus ? `Chapter focus: "${current.focus}"` : 'No chapter focus set.',
    '',
    `You have ${totalLeaves} actionable items. Here's where your attention is distributed:\n`,
  ];

  // Distribution table
  lines.push('### Action Distribution by Area\n');
  const distribution: { area: string; count: number; pct: number }[] = [];
  for (const area of areasSorted) {
    const count = areaCounts.get(area.id) ?? 0;
    if (count === 0) continue;
    distribution.push({ area: area.description, count, pct: Math.round((count / totalLeaves) * 100) });
  }
  distribution.sort((a, b) => b.count - a.count);

  for (const d of distribution) {
    const bar = '█'.repeat(Math.max(1, Math.round(d.pct / 5)));
    lines.push(`  ${d.area}: ${d.count} actions (${d.pct}%) ${bar}`);
  }

  // Areas with zero actionable items
  const emptyAreas = areasSorted.filter((a) => !areaCounts.has(a.id) || areaCounts.get(a.id) === 0);
  if (emptyAreas.length > 0) {
    lines.push(`\n### ⚪ Areas with no actionable items\n`);
    for (const a of emptyAreas) {
      lines.push(`  ${a.description} — nothing ready to work on`);
    }
  }

  // Tier distribution of actionable items
  lines.push('\n### Tier Distribution\n');
  const tierCounts = new Map<number, number>();
  for (const g of leaves) {
    tierCounts.set(g.goal_tier_id, (tierCounts.get(g.goal_tier_id) ?? 0) + 1);
  }
  const tiersSorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
  for (const t of tiersSorted) {
    const count = tierCounts.get(t.id) ?? 0;
    if (count === 0) continue;
    lines.push(`  ${t.description}: ${count} actions`);
  }

  lines.push('\n### Reflection Questions\n');
  lines.push(`- Does this distribution match your chapter focus?`);
  lines.push(`- Are high-action areas genuinely your priority, or are they just easier?`);
  lines.push(`- Do empty areas need decomposition, or are they intentionally parked?`);

  return lines.join('\n');
}
