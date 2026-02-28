ALTER TABLE referrals
ADD COLUMN IF NOT EXISTS keyword_matching TEXT;

UPDATE referrals
SET keyword_matching = 'Medium'
WHERE keyword_matching IS NULL OR TRIM(keyword_matching) = '';

ALTER TABLE referrals
ALTER COLUMN keyword_matching SET DEFAULT 'Medium';
