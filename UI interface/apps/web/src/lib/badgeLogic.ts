import { BADGES, BADGE_ORDER, type BadgeDefinition } from "../constants/badges";

export type BadgeStats = {
  weeklyApplications: number;
  streak: number;
  rivalWins: number;
};

export function getEarnedBadgeIds(stats: BadgeStats): Set<string> {
  const earned = new Set<string>();

  if (stats.streak >= 3) earned.add(BADGES.consistency.bronze.id);
  if (stats.streak >= 5) earned.add(BADGES.consistency.silver.id);
  if (stats.streak >= 6) earned.add(BADGES.consistency.gold.id);
  if (stats.streak >= 7) earned.add(BADGES.consistency.platinum.id);

  if (stats.weeklyApplications >= 8) earned.add(BADGES.applications.bronze.id);
  if (stats.weeklyApplications >= 14) earned.add(BADGES.applications.silver.id);
  if (stats.weeklyApplications >= 20) earned.add(BADGES.applications.gold.id);
  if (stats.weeklyApplications >= 28) earned.add(BADGES.applications.platinum.id);

  if (stats.rivalWins >= 1) earned.add(BADGES.rivalry.bronze.id);
  if (stats.rivalWins >= 3) earned.add(BADGES.rivalry.silver.id);
  if (stats.rivalWins >= 5) earned.add(BADGES.rivalry.gold.id);
  if (stats.rivalWins >= 7) earned.add(BADGES.rivalry.platinum.id);

  return earned;
}

export function getEarnedBadges(stats: BadgeStats): BadgeDefinition[] {
  const earned = getEarnedBadgeIds(stats);
  return BADGE_ORDER.filter((badge) => earned.has(badge.id));
}
