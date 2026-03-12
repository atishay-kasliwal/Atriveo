import json
import urllib.request
import urllib.error
from pathlib import Path

vals = {}
for line in Path('.dev.vars').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    key = key.strip()
    if not key:
        continue
    vals[key] = value.strip().strip('"').strip("'")

api_key = vals.get('RESEND_API_KEY', '').strip()
email_from = vals.get('EMAIL_FROM', 'noreply@atriveo.com').strip() or 'noreply@atriveo.com'

if not api_key:
    raise SystemExit('RESEND_API_KEY missing in .dev.vars')

html_path = Path('/tmp/atriveo-email-preview/daily-stats.preview.html')
text_path = Path('/tmp/atriveo-email-preview/daily-stats.preview.txt')
if not html_path.exists() or not text_path.exists():
    raise SystemExit('Preview files missing. Run render-email-preview.mjs first.')

payload = {
    'from': email_from,
    'to': ['katishay@gmail.com'],
    'subject': 'Atriveo Daily Digest Test (Manual Trigger)',
    'html': html_path.read_text(),
    'text': text_path.read_text(),
}

req = urllib.request.Request(
    'https://api.resend.com/emails',
    data=json.dumps(payload).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    },
    method='POST',
)

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read().decode('utf-8')
        print('status=', response.status)
        print('response=', body)
except urllib.error.HTTPError as error:
    print('status=', error.code)
    print('response=', error.read().decode('utf-8'))
    raise
