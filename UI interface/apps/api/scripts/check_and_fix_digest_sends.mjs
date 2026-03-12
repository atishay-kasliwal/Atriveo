import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';

const envText = fs.readFileSync('.dev.vars', 'utf8');
const match = envText.match(/^NEON_DATABASE_URL=(.*)$/m);
const dbUrl = match ? match[1].trim() : '';
if (!dbUrl) { console.log('NO_DB_URL'); process.exit(1); }
const sql = neon(dbUrl);

const emails = ['moraish.kapoor@stonybrook.edu', 'atishay.kasliwal@stonybrook.edu'];

const rows = await sql`
  SELECT s.id, u.email, s.digest_date, s.digest_type, s.status, s.email_to, s.provider_message_id, s.error_message, s.created_at
  FROM daily_digest_email_sends s
  JOIN dashboard_users u ON u.id = s.user_id
  WHERE LOWER(u.email) = ANY(${emails})
  ORDER BY s.created_at DESC
`;
console.log('Existing rows:', JSON.stringify(rows, null, 2));

// Delete rows where email was NOT actually delivered (no provider_message_id)
// so they can be retried
const toDelete = rows.filter(r => !r.provider_message_id);
if (toDelete.length > 0) {
  const ids = toDelete.map(r => r.id);
  console.log('Deleting non-delivered rows with ids:', ids);
  await sql`DELETE FROM daily_digest_email_sends WHERE id = ANY(${ids})`;
  console.log('Deleted', ids.length, 'rows.');
} else {
  console.log('All rows have a resend_message_id (already delivered). Nothing to delete.');
}
