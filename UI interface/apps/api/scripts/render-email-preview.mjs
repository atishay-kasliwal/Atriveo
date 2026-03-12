import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/atishaykasliwal/Desktop/Atriveo/UI interface/apps/api/email-templates';
const htmlTemplate = fs.readFileSync(path.join(root, 'daily-stats.html'), 'utf8');
const txtTemplate = fs.readFileSync(path.join(root, 'daily-stats.txt'), 'utf8');

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
const RANK_EMOJIS = ['🔥', '💪', '✨', '👏', '🎉'];

function toInt(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(name) {
  const raw = String(name ?? '').trim();
  return raw || 'Friend';
}

function resolveProgress(appsToday, dailyTarget) {
  if (dailyTarget <= 0) {
    return {
      progressPercent: 0,
      statusColor: '#6b7280',
      statusMessage: 'No daily target set yet.',
    };
  }
  const percent = clamp(Math.round((appsToday / dailyTarget) * 100), 0, 100);
  if (appsToday >= dailyTarget) {
    return {
      progressPercent: percent,
      statusColor: '#10b981',
      statusMessage: '✅ Target achieved! Amazing work!',
    };
  }
  if (percent >= 50) {
    return {
      progressPercent: percent,
      statusColor: '#f59e0b',
      statusMessage: '🔥 You are close. Keep pushing!',
    };
  }
  return {
    progressPercent: percent,
    statusColor: '#6b7280',
    statusMessage: 'No applications yet today. Let us get one in!',
  };
}

function buildFriends(rawFriends) {
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
    const barPercent = maxApps > 0 ? Math.round((f.friendApps / maxApps) * 100) : 0;
    return {
      medal: RANK_MEDALS[index] || `${index + 1}.`,
      friendEmoji: RANK_EMOJIS[index] || '✨',
      friendName: f.friendName,
      friendApps: f.friendApps,
      friendAppsPlural: f.friendApps === 1 ? '' : 's',
      friendTargets: f.friendTargets,
      friendTargetsPlural: f.friendTargets === 1 ? '' : 's',
      friendBarPercent: clamp(barPercent, 12, 100),
    };
  });
}

function replaceVars(str, vars) {
  return str.replace(/{{(\w+)}}/g, (_, k) => (vars[k] ?? '').toString());
}

function renderConditions(str, vars) {
  return str.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (full, key, block) => {
    const value = vars[key];
    if (Array.isArray(value)) return full;
    return value ? block : '';
  });
}

function renderList(str, key, items) {
  const re = new RegExp(`{{#${key}}}([\\s\\S]*?){{\\/${key}}}`, 'g');
  return str.replace(re, (_, block) =>
    items
      .map((item) => {
        const withLocalConditionals = block.replace(
          /{{#(\w+)}}([\s\S]*?){{\/\1}}/g,
          (_m, ck, cb) => (item[ck] ? cb : '')
        );
        return withLocalConditionals.replace(/{{(\w+)}}/g, (_m2, vk) => (item[vk] ?? '').toString());
      })
      .join('')
  );
}

function renderEmail(variantName, input) {
  const appsToday = toInt(input.appsToday);
  const totalApps = toInt(input.totalApps, appsToday);
  const totalTargetApps = Math.min(toInt(input.totalTargetApps), totalApps);
  const targetCompanyCount = Math.min(toInt(input.targetCompanyCount, totalTargetApps), totalApps);
  const dailyTarget = toInt(input.dailyTarget);
  const progress = resolveProgress(appsToday, dailyTarget);
  const friends = buildFriends(input.friends ?? []);
  const friendsTotalApps = friends.reduce((sum, friend) => sum + friend.friendApps, 0);

  const model = {
    date: String(input.date || 'March 11, 2026'),
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
    managePreferencesUrl: String(input.managePreferencesUrl || 'https://www.atriveo.com/email-preferences'),
    unsubscribeUrl: String(input.unsubscribeUrl || 'https://www.atriveo.com/unsubscribe?token=demo-token'),
    hasFriends: friends.length > 0,
    noFriends: friends.length === 0,
  };

  let html = htmlTemplate;
  html = renderList(html, 'friends', friends);
  html = renderConditions(html, model);
  html = replaceVars(html, model);

  let txt = txtTemplate;
  txt = renderList(txt, 'friends', friends);
  txt = renderConditions(txt, model);
  txt = replaceVars(txt, model);

  return {
    html,
    txt,
    unresolvedHtml: /{{[^}]+}}/.test(html),
    unresolvedTxt: /{{[^}]+}}/.test(txt),
    friendCount: friends.length,
    variantName,
  };
}

const baseInput = {
  date: 'March 11, 2026',
  firstName: 'Atishay',
  appsToday: 14,
  targetCompanyCount: 10,
  totalApps: 8,
  totalTargetApps: 4,
  dailyTarget: 8,
  managePreferencesUrl: 'https://www.atriveo.com/email-preferences',
  unsubscribeUrl: 'https://www.atriveo.com/unsubscribe?token=test-token',
};

const friendPool = [
  { friendName: 'Alice Smith', friendApps: 3, friendTargets: 1 },
  { friendName: 'Bob Johnson', friendApps: 2, friendTargets: 0 },
  { friendName: 'Carol Lee', friendApps: 1, friendTargets: 1 },
  { friendName: 'David Chen', friendApps: 1, friendTargets: 0 },
  { friendName: 'Emma Wilson', friendApps: 1, friendTargets: 0 },
];

const outDir = '/tmp/atriveo-email-preview';
fs.mkdirSync(outDir, { recursive: true });

for (let count = 0; count <= 5; count += 1) {
  const friends = friendPool.slice(0, count);
  const variant = renderEmail(`${count}-friends`, {
    ...baseInput,
    friends,
  });

  const htmlOut = path.join(outDir, `daily-stats.${variant.variantName}.html`);
  const txtOut = path.join(outDir, `daily-stats.${variant.variantName}.txt`);
  fs.writeFileSync(htmlOut, variant.html);
  fs.writeFileSync(txtOut, variant.txt);
  console.log(`${variant.variantName}: html=${htmlOut} txt=${txtOut} unresolvedHtml=${variant.unresolvedHtml} unresolvedTxt=${variant.unresolvedTxt}`);
}

const canonical = renderEmail('preview', {
  ...baseInput,
  friends: friendPool,
});
const htmlOut = path.join(outDir, 'daily-stats.preview.html');
const txtOut = path.join(outDir, 'daily-stats.preview.txt');
fs.writeFileSync(htmlOut, canonical.html);
fs.writeFileSync(txtOut, canonical.txt);

console.log('OK');
console.log(htmlOut);
console.log(txtOut);
console.log(`unresolved-html=${canonical.unresolvedHtml}`);
console.log(`unresolved-txt=${canonical.unresolvedTxt}`);
