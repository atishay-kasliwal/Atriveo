export type DailyDigestFriendInput = {
  friendName?: string | null;
  friendApps?: number | null;
  friendTargets?: number | null;
};

export type DailyDigestTargetHitInput = {
  company: string;
  role: string;
  applicants: string;
  lastAppliedAt: string;
};

export type DailyDigestRenderInput = {
  date?: string | null;
  firstName?: string | null;
  appsToday?: number | null;
  targetCompanyCount?: number | null;
  totalApps?: number | null;
  totalTargetApps?: number | null;
  dailyTarget?: number | null;
  managePreferencesUrl?: string | null;
  unsubscribeUrl?: string | null;
  friends?: DailyDigestFriendInput[] | null;
  targetHits?: DailyDigestTargetHitInput[] | null;
};

export type DailyDigestRenderModel = {
  date: string;
  firstName: string;
  appsToday: number;
  targetCompanyCount: number;
  friendsTotalApps: number;
  totalApps: number;
  totalTargetApps: number;
  dailyTarget: number;
  progressPercent: number;
  statusColor: string;
  statusMessage: string;
  managePreferencesUrl: string;
  unsubscribeUrl: string;
  hasFriends: boolean;
  noFriends: boolean;
  friends: Array<{
    medal: string;
    friendEmoji: string;
    friendName: string;
    friendApps: number;
    friendAppsPlural: string;
    friendTargets: number;
    friendTargetsPlural: string;
    friendBarPercent: number;
  }>;
  hasTargetHits: boolean;
  targetHits: Array<{
    company: string;
    role: string;
    applicants: string;
    lastAppliedAt: string;
  }>;
};

const RANK_MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
const RANK_EMOJIS = ["🔥", "💪", "✨", "👏", "🎉"];

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Daily Network Stats - Atriveo</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fb; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0b1220;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fb;">
  <tr><td align="center" style="padding: 24px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="background-color: #0b1220; padding: 32px 32px 26px; text-align: left; border-radius: 14px 14px 0 0;">
          <p style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.2px; line-height: 1.2;">Atriveo<span style="color: #0066ff;">.</span></p>
          <h1 style="margin: 18px 0 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.25;">Daily Network Stats</h1>
          <p style="margin: 8px 0 0; color: #c9d2e0; font-size: 14px; font-weight: 500;">{{date}}</p>
        </td>
      </tr>
      <tr>
        <td style="background-color: #ffffff; border: 1px solid #dbe4ef; border-top: 0; padding: 0 28px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 22px;"><tr><td style="background-color: #eef4ff; border: 1px solid #d6e5ff; border-radius: 12px; padding: 18px;"><p style="margin: 0; font-size: 17px; color: #0b1220; line-height: 1.45;">Hi <strong>{{firstName}}</strong>, here is what your network achieved today.</p></td></tr></table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;"><tr><td><h2 style="margin: 0 0 14px; font-size: 18px; color: #0b1220; font-weight: 700;">Your Progress Today</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="48%" style="padding-right: 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;"><p style="margin: 0; font-size: 28px; font-weight: 800; color: #0066ff;">{{appsToday}}</p><p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.7px;">Applications</p></td></tr></table></td>
              <td width="48%" style="padding-left: 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;"><p style="margin: 0; font-size: 28px; font-weight: 800; color: #0066ff;">{{friendsTotalApps}}</p><p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.7px;">Friends Total</p></td></tr></table></td>
            </tr></table>
            <p style="margin: 15px 0 8px; font-size: 14px; color: #475569;">Daily target: <strong style="color: #0b1220;">{{dailyTarget}} applications</strong></p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #e2e8f0; border-radius: 999px; height: 10px; overflow: hidden;"><table role="presentation" width="{{progressPercent}}%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #0066ff; border-radius: 999px; height: 10px;">&nbsp;</td></tr></table></td></tr></table>
            <p style="margin: 7px 0 0; font-size: 13px; font-weight: 700; color: #334155; text-align: right;">{{progressPercent}}%</p>
            <p style="margin: 8px 0 0; font-size: 14px; font-weight: 700; color: {{statusColor}};">{{statusMessage}}</p>
          </td></tr></table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;"><tr><td style="border-top: 1px solid #e2e8f0;">&nbsp;</td></tr></table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><h2 style="margin: 0 0 14px; font-size: 18px; color: #0b1220; font-weight: 700;">Friends Activity (Top 5)</h2>
            {{#hasFriends}}
            {{#friends}}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #e2e8f0;"><tr>
              <td style="padding: 13px 0; vertical-align: middle; width: 34px;"><span style="font-size: 22px;">{{medal}}</span></td>
              <td style="padding: 13px 8px; vertical-align: middle; width: 118px;"><p style="margin: 0; font-size: 14px; font-weight: 700; color: #0b1220; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{friendName}}</p></td>
              <td style="padding: 13px 8px; vertical-align: middle;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color: #e2e8f0; border-radius: 8px; height: 30px; overflow: hidden;"><table role="presentation" width="{{friendBarPercent}}%" cellpadding="0" cellspacing="0" border="0" style="min-width: 36px;"><tr><td style="background-color: #0066ff; border-radius: 8px; height: 30px; color: #ffffff; font-size: 14px; font-weight: 700; padding: 0 10px; white-space: nowrap;">{{friendApps}}</td></tr></table></td></tr></table></td>
              <td style="padding: 13px 8px; vertical-align: middle; width: 84px; text-align: left;"><p style="margin: 0; font-size: 12px; color: #64748b; white-space: nowrap;">{{#friendTargets}}<span style="display: inline-block; background-color: #e7f0ff; color: #0b3ea8; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">{{friendTargets}} target{{friendTargetsPlural}}</span>{{/friendTargets}}</p></td>
              <td style="padding: 13px 0; vertical-align: middle; text-align: right; width: 34px;"><span style="font-size: 22px;">{{friendEmoji}}</span></td>
            </tr></table>
            {{/friends}}
            {{/hasFriends}}
            {{#noFriends}}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #e2e8f0;"><tr>
              <td style="padding: 14px 0; vertical-align: middle;"><p style="margin: 0; font-size: 14px; color: #64748b;">No friend activity has been recorded yet today.</p></td>
            </tr></table>
            {{/noFriends}}
          </td></tr></table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;"><tr><td style="border-top: 1px solid #e2e8f0;">&nbsp;</td></tr></table>

          {{#hasTargetHits}}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
            <h2 style="margin: 0 0 4px; font-size: 18px; color: #0b1220; font-weight: 700;">Your Targets — Applied Today</h2>
            <p style="margin: 0 0 14px; font-size: 13px; color: #64748b;">Your network is making moves — friends applied to top companies today.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
              <tr style="background-color: #f8fafc;">
                <th style="padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">Company</th>
                <th style="padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Role</th>
                <th style="padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Who Applied</th>
                <th style="padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">Last At</th>
                <th style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;"></th>
              </tr>
              {{#targetHits}}
              <tr>
                <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #0b1220; border-bottom: 1px solid #f1f5f9;">{{company}}</td>
                <td style="padding: 10px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9;">{{role}}</td>
                <td style="padding: 10px 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9;">{{applicants}}</td>
                <td style="padding: 10px 12px; font-size: 13px; color: #64748b; white-space: nowrap; border-bottom: 1px solid #f1f5f9;">{{lastAppliedAt}}</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; white-space: nowrap;"><a href="https://tracker.atriveo.com/dashboard/network" style="color: #0066ff; font-size: 13px; font-weight: 600; text-decoration: none;">View &rarr;</a></td>
              </tr>
              {{/targetHits}}
            </table>
          </td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;"><tr><td style="border-top: 1px solid #e2e8f0;">&nbsp;</td></tr></table>
          {{/hasTargetHits}}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 16px; line-height: 1.2;">Total Applications</td>
              <td style="padding: 10px 0; color: #0b1220; font-size: 30px; font-weight: 800; line-height: 1; text-align: right; width: 1px;">{{totalApps}}</td>
            </tr></table>
          </td></tr></table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px;"><tr><td align="center"><a href="https://tracker.atriveo.com/dashboard" target="_blank" style="display: inline-block; background-color: #0066ff; color: #ffffff; padding: 13px 34px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; line-height: 1.4;">Open Atriveo Dashboard</a></td></tr></table>

        </td>
      </tr>
      <tr><td style="background-color: #f8fafc; border: 1px solid #dbe4ef; border-top: 0; padding: 22px 28px; text-align: center; border-radius: 0 0 14px 14px;"><p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.65;">You are receiving this because daily network stats are enabled for your account.<br><a href="{{managePreferencesUrl}}" style="color: #0066ff; text-decoration: underline;">Manage Preferences</a> | <a href="{{unsubscribeUrl}}" style="color: #0066ff; text-decoration: underline;">Unsubscribe</a></p></td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

const TEXT_TEMPLATE = `ATRIVEO DAILY NETWORK STATS - {{date}}
============================================

Hi {{firstName}}, here is what your network achieved today.

--------------------------------------------
YOUR PROGRESS TODAY
--------------------------------------------

Applications Today: {{appsToday}}
Friends Total Apps: {{friendsTotalApps}}

Daily Target: {{dailyTarget}} applications
Progress:     {{progressPercent}}%

{{statusMessage}}

--------------------------------------------
FRIENDS ACTIVITY (Top 5)
--------------------------------------------

{{#hasFriends}}
{{#friends}}
{{medal}} {{friendName}} - {{friendApps}} application{{friendAppsPlural}} today{{#friendTargets}} ({{friendTargets}} target{{friendTargetsPlural}}){{/friendTargets}}
{{/friends}}
{{/hasFriends}}
{{#noFriends}}
No friend activity has been recorded yet today.
{{/noFriends}}

{{#hasTargetHits}}
--------------------------------------------
YOUR TARGETS — APPLIED TODAY
--------------------------------------------

{{#targetHits}}
{{company}} | {{role}} | {{applicants}} | {{lastAppliedAt}}
{{/targetHits}}
Network page: https://tracker.atriveo.com/dashboard/network
{{/hasTargetHits}}

--------------------------------------------
NETWORK TOTALS
--------------------------------------------

Total Applications: {{totalApps}}

--------------------------------------------

Open Dashboard: https://tracker.atriveo.com/dashboard
Manage Preferences: {{managePreferencesUrl}}
Unsubscribe: {{unsubscribeUrl}}
`;

function toInt(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(name: unknown): string {
  const raw = String(name ?? "").trim();
  return raw || "Friend";
}

function resolveProgress(appsToday: number, dailyTarget: number): {
  progressPercent: number;
  statusColor: string;
  statusMessage: string;
} {
  if (dailyTarget <= 0) {
    return {
      progressPercent: 0,
      statusColor: "#6b7280",
      statusMessage: "No daily target set yet.",
    };
  }
  const percent = clamp(Math.round((appsToday / dailyTarget) * 100), 0, 100);
  if (appsToday >= dailyTarget) {
    return {
      progressPercent: percent,
      statusColor: "#10b981",
      statusMessage: "Target achieved! Amazing work!",
    };
  }
  if (percent >= 50) {
    return {
      progressPercent: percent,
      statusColor: "#f59e0b",
      statusMessage: "You are close. Keep pushing!",
    };
  }
  if (appsToday === 0) {
    return {
      progressPercent: percent,
      statusColor: "#6b7280",
      statusMessage: "No applications yet today. Let us get one in!",
    };
  }
  return {
    progressPercent: percent,
    statusColor: "#6b7280",
    statusMessage: `Good start with ${appsToday} application${appsToday === 1 ? "" : "s"}! Keep the momentum going.`,
  };
}

function buildFriends(rawFriends: DailyDigestFriendInput[]): DailyDigestRenderModel["friends"] {
  const sorted = [...rawFriends]
    .map((f) => ({
      friendName: normalizeName(f.friendName),
      friendApps: toInt(f.friendApps),
      friendTargets: toInt(f.friendTargets),
    }))
    .sort((a, b) => {
      if (b.friendApps !== a.friendApps) return b.friendApps - a.friendApps;
      return a.friendName.localeCompare(b.friendName);
    })
    .slice(0, 5);

  const maxApps = sorted.reduce((max, f) => Math.max(max, f.friendApps), 0);

  return sorted.map((f, index) => {
    const rawPercent = maxApps > 0 ? Math.round((f.friendApps / maxApps) * 100) : 0;
    return {
      medal: RANK_MEDALS[index] || `${index + 1}.`,
      friendEmoji: RANK_EMOJIS[index] || "*",
      friendName: f.friendName,
      friendApps: f.friendApps,
      friendAppsPlural: f.friendApps === 1 ? "" : "s",
      friendTargets: f.friendTargets,
      friendTargetsPlural: f.friendTargets === 1 ? "" : "s",
      friendBarPercent: clamp(rawPercent, 12, 100),
    };
  });
}

function replaceVars(str: string, vars: Record<string, unknown>): string {
  return str.replace(/{{(\w+)}}/g, (_match, key: string) => String(vars[key] ?? ""));
}

function renderConditions(str: string, vars: Record<string, unknown>): string {
  return str.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (full, key: string, block: string) => {
    const value = vars[key];
    if (Array.isArray(value)) return full;
    return value ? block : "";
  });
}

function renderList(str: string, key: string, items: Array<Record<string, unknown>>): string {
  const re = new RegExp(`{{#${key}}}([\\s\\S]*?){{\\/${key}}}`, "g");
  return str.replace(re, (_outer, block: string) =>
    items
      .map((item) => {
        const withLocalConditionals = block.replace(
          /{{#(\w+)}}([\s\S]*?){{\/\1}}/g,
          (_inner, condKey: string, condBlock: string) => (item[condKey] ? condBlock : ""),
        );
        return withLocalConditionals.replace(/{{(\w+)}}/g, (_varMatch, varKey: string) => String(item[varKey] ?? ""));
      })
      .join(""),
  );
}

export function buildDailyDigestRenderModel(input: DailyDigestRenderInput): DailyDigestRenderModel {
  const appsToday = toInt(input.appsToday);
  const totalApps = toInt(input.totalApps, appsToday);
  const totalTargetApps = Math.min(toInt(input.totalTargetApps), totalApps);
  const targetCompanyCount = Math.min(toInt(input.targetCompanyCount, totalTargetApps), totalApps);
  const dailyTarget = toInt(input.dailyTarget);
  const progress = resolveProgress(appsToday, dailyTarget);
  const friends = buildFriends(input.friends ?? []);
  const friendsTotalApps = friends.reduce((sum, friend) => sum + friend.friendApps, 0);

  const targetHits = (input.targetHits ?? []).map((h) => ({
    company: String(h.company || ""),
    role: String(h.role || "—"),
    applicants: String(h.applicants || ""),
    lastAppliedAt: String(h.lastAppliedAt || ""),
  }));

  return {
    date: String(input.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })),
    firstName: normalizeName(input.firstName),
    appsToday,
    targetCompanyCount,
    friendsTotalApps,
    totalApps,
    totalTargetApps,
    dailyTarget,
    progressPercent: progress.progressPercent,
    statusColor: progress.statusColor,
    statusMessage: progress.statusMessage,
    managePreferencesUrl: String(input.managePreferencesUrl || "https://tracker.atriveo.com/email-preferences"),
    unsubscribeUrl: String(input.unsubscribeUrl || "https://tracker.atriveo.com/unsubscribe"),
    hasFriends: friends.length > 0,
    noFriends: friends.length === 0,
    friends,
    hasTargetHits: targetHits.length > 0,
    targetHits,
  };
}

export function renderDailyDigestEmail(input: DailyDigestRenderInput): {
  subject: string;
  html: string;
  text: string;
  model: DailyDigestRenderModel;
} {
  const model = buildDailyDigestRenderModel(input);
  const renderVars: Record<string, unknown> = { ...model };

  let html = HTML_TEMPLATE;
  html = renderList(html, "friends", model.friends as Array<Record<string, unknown>>);
  html = renderList(html, "targetHits", model.targetHits as Array<Record<string, unknown>>);
  html = renderConditions(html, renderVars);
  html = replaceVars(html, renderVars);

  let text = TEXT_TEMPLATE;
  text = renderList(text, "friends", model.friends as Array<Record<string, unknown>>);
  text = renderList(text, "targetHits", model.targetHits as Array<Record<string, unknown>>);
  text = renderConditions(text, renderVars);
  text = replaceVars(text, renderVars);

  return {
    subject: `Your Atriveo Daily Network Stats - ${model.date}`,
    html,
    text,
    model,
  };
}
