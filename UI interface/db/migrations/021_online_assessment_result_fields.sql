-- Add outcome metadata for OA records so missed deadlines can be auto-archived.
ALTER TABLE online_assessment_records
  ADD COLUMN IF NOT EXISTS oa_result TEXT;

ALTER TABLE online_assessment_records
  ADD COLUMN IF NOT EXISTS oa_result_date DATE;

UPDATE online_assessment_records
SET
  oa_result = COALESCE(NULLIF(TRIM(oa_result), ''), 'Completed'),
  oa_result_date = COALESCE(oa_result_date, oa_completed_date, CURRENT_DATE)
WHERE oa_result IS NULL
   OR oa_result_date IS NULL;

ALTER TABLE online_assessment_records
  ALTER COLUMN oa_result SET DEFAULT 'Completed';

ALTER TABLE online_assessment_records
  ALTER COLUMN oa_result_date SET DEFAULT CURRENT_DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_oa_records_result'
  ) THEN
    ALTER TABLE online_assessment_records
      ADD CONSTRAINT ck_oa_records_result CHECK (oa_result IN ('Completed', 'Missed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_oa_records_user_result_date
  ON online_assessment_records (user_id, oa_result_date DESC, id DESC);
