-- Keep oa_status as a simple "received OA?" flag (Yes/No).
-- Lifecycle (Pending/Missed/Completed) is represented by active-vs-archive + oa_result.

UPDATE jobs
SET oa_status = CASE
  WHEN LOWER(TRIM(COALESCE(oa_status, ''))) IN ('yes', 'pending', 'completed', 'complete', 'done', 'missed', 'missing', 'overdue')
    THEN 'Yes'
  ELSE 'No'
END;

UPDATE online_assessment_records
SET oa_status = CASE
  WHEN LOWER(TRIM(COALESCE(oa_status, ''))) IN ('yes', 'pending', 'completed', 'complete', 'done', 'missed', 'missing', 'overdue')
    THEN 'Yes'
  ELSE 'No'
END;

ALTER TABLE jobs
  ALTER COLUMN oa_status SET DEFAULT 'No';
