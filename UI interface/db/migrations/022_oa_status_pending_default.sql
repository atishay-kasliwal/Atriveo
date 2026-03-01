-- Normalize OA status model to Pending/Completed/Missed/No.
-- Keep legacy compatibility by converting prior "Yes" values to "Pending".

UPDATE jobs
SET oa_status = 'Pending'
WHERE LOWER(TRIM(COALESCE(oa_status, ''))) = 'yes';

UPDATE online_assessment_records
SET oa_status = 'Pending'
WHERE LOWER(TRIM(COALESCE(oa_status, ''))) = 'yes';

ALTER TABLE jobs
  ALTER COLUMN oa_status SET DEFAULT 'Pending';
