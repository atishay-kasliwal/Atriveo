export type NetworkTickerTodayRow = {
  label: string;
  total: number;
};

export type NetworkTickerWeeklyRow = {
  displayName: string;
  total: number;
  dailyWins: number;
  dayValues: number[];
};

export type NetworkTickerTone = "gold" | "blue";

export type NetworkTickerFact = {
  text: string;
  tone: NetworkTickerTone;
};

type BuildNetworkTickerInput = {
  todayRows: NetworkTickerTodayRow[];
  weeklyLeaderboard: NetworkTickerWeeklyRow[];
  friendSlotsText?: string;
  minChars?: number;
};

function uniqueFacts(facts: NetworkTickerFact[]): NetworkTickerFact[] {
  const seen = new Set<string>();
  const rows: NetworkTickerFact[] = [];
  facts.forEach((fact) => {
    const text = fact.text.trim();
    if (!text) return;
    if (seen.has(text)) return;
    seen.add(text);
    rows.push({ ...fact, text });
  });
  return rows;
}

export function buildNetworkTickerFacts(input: BuildNetworkTickerInput): NetworkTickerFact[] {
  const facts: NetworkTickerFact[] = [];
  const weekly = input.weeklyLeaderboard.slice().sort((a, b) => b.total - a.total);
  const today = input.todayRows.slice().sort((a, b) => b.total - a.total);
  const weeklyLeader = weekly[0];
  const weeklyRunnerUp = weekly[1];
  const todayLeader = today[0];

  if (!weeklyLeader && !todayLeader) {
    return [{ text: "Weekly leaderboard update", tone: "blue" }];
  }

  if (weeklyLeader) {
    facts.push({
      text: `Weekly Leader: ${weeklyLeader.displayName} · ${weeklyLeader.total}`,
      tone: weeklyLeader.displayName === "You" ? "gold" : "blue",
    });
  }
  if (weeklyRunnerUp) {
    facts.push({
      text: `Runner-Up: ${weeklyRunnerUp.displayName} · ${weeklyRunnerUp.total}`,
      tone: weeklyRunnerUp.displayName === "You" ? "gold" : "blue",
    });
    const gap = Math.max(0, weeklyLeader.total - weeklyRunnerUp.total);
    facts.push({ text: `Lead: +${gap}`, tone: weeklyLeader.displayName === "You" ? "gold" : "blue" });
  }

  if (todayLeader) {
    facts.push({
      text: `Leading Today: ${todayLeader.label} · ${todayLeader.total}`,
      tone: todayLeader.label === "You" ? "gold" : "blue",
    });
  }

  const closeRacePair = (() => {
    if (weekly.length < 2) return null;
    let best: { a: string; b: string; gap: number } | null = null;
    for (let i = 1; i < weekly.length; i += 1) {
      const prev = weekly[i - 1];
      const curr = weekly[i];
      const gap = Math.abs(prev.total - curr.total);
      if (!best || gap < best.gap) {
        best = { a: prev.displayName, b: curr.displayName, gap };
      }
    }
    return best;
  })();
  if (closeRacePair) {
    facts.push({
      text: `Close Race: ${closeRacePair.a} vs ${closeRacePair.b} · ${closeRacePair.gap} apart`,
      tone: closeRacePair.a === "You" || closeRacePair.b === "You" ? "gold" : "blue",
    });
  }

  const winsLeader = weekly
    .slice()
    .sort((a, b) => b.dailyWins - a.dailyWins)[0];
  if (winsLeader) {
    const safeWins = Math.max(0, Math.min(7, Number(winsLeader.dailyWins || 0)));
    facts.push({
      text: `Most Daily Wins: ${winsLeader.displayName} · ${safeWins}`,
      tone: winsLeader.displayName === "You" ? "gold" : "blue",
    });
  }

  const teamTotal = weekly.reduce((sum, row) => sum + Math.max(0, Number(row.total || 0)), 0);
  if (teamTotal > 0) {
    facts.push({ text: `Team Total: ${teamTotal}`, tone: "blue" });
  }

  const consistencyLeader = weekly
    .map((row) => ({
      name: row.displayName,
      activeDays: row.dayValues.filter((v) => Number(v) > 0).length,
    }))
    .sort((a, b) => b.activeDays - a.activeDays)[0];
  if (consistencyLeader && consistencyLeader.activeDays > 0) {
    facts.push({
      text: `Most Consistent: ${consistencyLeader.name} · ${consistencyLeader.activeDays}/7`,
      tone: consistencyLeader.name === "You" ? "gold" : "blue",
    });
  }

  const topSingleDay = (() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let best: { name: string; count: number; day: string } | null = null;
    weekly.forEach((row) => {
      row.dayValues.forEach((count, idx) => {
        const safe = Math.max(0, Number(count ?? 0));
        if (!best || safe > best.count) {
          best = { name: row.displayName, count: safe, day: labels[idx] ?? "Day" };
        }
      });
    });
    return best;
  })();
  if (topSingleDay) {
    facts.push({
      text: `Top Single Day: ${topSingleDay.name} · ${topSingleDay.count} (${topSingleDay.day})`,
      tone: topSingleDay.name === "You" ? "gold" : "blue",
    });
  }

  return uniqueFacts(facts);
}

export function buildNetworkTickerText(input: BuildNetworkTickerInput): string {
  const facts = buildNetworkTickerFacts(input);
  const minChars = Math.max(80, Number(input.minChars ?? 220));
  const seed = facts.map((f) => f.text).join("  •  ");
  let text = seed;
  while (text.length < minChars) {
    text = `${text}  •  ${seed}`;
  }
  return text;
}
