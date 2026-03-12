import { query } from "./db";
import { renderDailyDigestEmail, type DailyDigestFriendInput, type DailyDigestRenderInput } from "./dailyDigestEmail";
import type { Bindings } from "./types";

type SendDailyDigestArgs = {
  userId: number;
  digestDate?: string | null;
  digestType?: string;
  overrides?: Partial<DailyDigestRenderInput>;
};

type SendDailyDigestResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  digestDate: string;
  digestType: string;
  messageId?: string | null;
};

function estDateIso(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

function normalizeDigestDate(raw?: string | null): string {
  const value = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return estDateIso();
}

async function sendViaResend(
  env: Bindings,
  toEmail: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ delivered: boolean; messageId: string | null; error?: string }> {
  const resendApiKey = String(env.RESEND_API_KEY ?? "").trim();
  const configuredFrom = String(env.EMAIL_FROM ?? "noreply@atriveo.com").trim() || "noreply@atriveo.com";
  const sender = configuredFrom.includes("<") ? configuredFrom : `Atriveo <${configuredFrom}>`;

  if (!resendApiKey) {
    console.warn(`[digest] RESEND_API_KEY is not set. Preview-only digest for ${toEmail}`);
    return { delivered: false, messageId: null, error: "RESEND_API_KEY missing" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [toEmail],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return { delivered: false, messageId: null, error: `Resend failed (${response.status}): ${details}` };
  }

  const payload = (await response.json().catch(() => ({}))) as { id?: string };
  return { delivered: true, messageId: payload.id ?? null };
}

async function buildDefaultDigestInput(
  env: Bindings,
  userId: number,
  digestDate: string,
): Promise<{ toEmail: string; firstName: string; digest: DailyDigestRenderInput }> {
  const [user] = await query<{ email: string; first_name: string | null }>(
    env,
    `
    SELECT email, first_name
    FROM dashboard_users
    WHERE id = $1
    LIMIT 1
    `,
    [userId],
  );

  if (!user?.email) {
    throw new Error("User email not found for digest send.");
  }

  const [selfStats] = await query<{ apps_today: number }>(
    env,
    `
    SELECT COUNT(*)::int AS apps_today
    FROM jobs
    WHERE user_id = $1
      AND date_saved IS NOT NULL
      AND date_saved::date = $2::date
    `,
    [userId, digestDate],
  );

  const [targetRow] = await query<{ daily_target: number | null }>(
    env,
    `
    SELECT daily_target
    FROM user_targets
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  );

  const friendStats = await query<{
    friend_name: string;
    apps_today: number;
  }>(
    env,
    `
    WITH friends AS (
      SELECT
        CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END AS friend_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS friend_name
      FROM friendships f
      JOIN dashboard_users u
        ON u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.receiver_id = $1)
        AND f.status = 'accepted'
    )
    SELECT
      fr.friend_name,
      COUNT(j.id)::int AS apps_today
    FROM friends fr
    LEFT JOIN jobs j
      ON j.user_id = fr.friend_id
     AND j.date_saved IS NOT NULL
     AND j.date_saved::date = $2::date
    GROUP BY fr.friend_name
    HAVING COUNT(j.id) > 0
    ORDER BY COUNT(j.id) DESC, LOWER(fr.friend_name) ASC
    LIMIT 5
    `,
    [userId, digestDate],
  );

  const friends: DailyDigestFriendInput[] = friendStats.map((row) => ({
    friendName: row.friend_name,
    friendApps: Number(row.apps_today ?? 0),
    friendTargets: 0,
  }));

  const appsToday = Number(selfStats?.apps_today ?? 0);
  const dailyTarget = Number(targetRow?.daily_target ?? 0);
  const firstName = String(user.first_name ?? "").trim() || "Friend";

  return {
    toEmail: String(user.email),
    firstName,
    digest: {
      date: digestDate,
      firstName,
      appsToday,
      targetCompanyCount: 0,
      totalApps: appsToday,
      totalTargetApps: 0,
      dailyTarget,
      managePreferencesUrl: "https://www.atriveo.com/email-preferences",
      unsubscribeUrl: "https://www.atriveo.com/unsubscribe",
      friends,
    },
  };
}

export async function sendDailyDigestForUser(
  env: Bindings,
  args: SendDailyDigestArgs,
): Promise<SendDailyDigestResult> {
  const userId = Number(args.userId);
  const digestDate = normalizeDigestDate(args.digestDate);
  const digestType = String(args.digestType ?? "daily_network_digest").trim() || "daily_network_digest";

  const [idempotentInsert] = await query<{ id: number }>(
    env,
    `
    INSERT INTO daily_digest_email_sends (user_id, digest_date, digest_type, status)
    VALUES ($1, $2::date, $3, 'skipped')
    ON CONFLICT (user_id, digest_date, digest_type) DO NOTHING
    RETURNING id
    `,
    [userId, digestDate, digestType],
  );

  if (!idempotentInsert) {
    return {
      ok: true,
      skipped: true,
      reason: "already_sent_or_logged",
      digestDate,
      digestType,
    };
  }

  const entryId = Number(idempotentInsert.id);

  try {
    const base = await buildDefaultDigestInput(env, userId, digestDate);
    const rendered = renderDailyDigestEmail({
      ...base.digest,
      ...(args.overrides ?? {}),
      firstName: args.overrides?.firstName ?? base.firstName,
    });

    const send = await sendViaResend(env, base.toEmail, rendered.subject, rendered.html, rendered.text);

    if (!send.delivered) {
      await query(
        env,
        `
        UPDATE daily_digest_email_sends
        SET status = 'failed',
            email_to = $2,
            subject = $3,
            error_message = $4,
            payload_json = $5::jsonb
        WHERE id = $1
        `,
        [entryId, base.toEmail, rendered.subject, send.error ?? "unknown_send_error", JSON.stringify(rendered.model)],
      );
      return {
        ok: false,
        skipped: false,
        reason: send.error ?? "send_failed",
        digestDate,
        digestType,
      };
    }

    await query(
      env,
      `
      UPDATE daily_digest_email_sends
      SET status = 'sent',
          email_to = $2,
          subject = $3,
          provider_message_id = $4,
          payload_json = $5::jsonb,
          sent_at = NOW(),
          error_message = NULL
      WHERE id = $1
      `,
      [entryId, base.toEmail, rendered.subject, send.messageId, JSON.stringify(rendered.model)],
    );

    return {
      ok: true,
      skipped: false,
      digestDate,
      digestType,
      messageId: send.messageId,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    await query(
      env,
      `
      UPDATE daily_digest_email_sends
      SET status = 'failed',
          error_message = $2
      WHERE id = $1
      `,
      [entryId, reason],
    );
    return {
      ok: false,
      skipped: false,
      reason,
      digestDate,
      digestType,
    };
  }
}
