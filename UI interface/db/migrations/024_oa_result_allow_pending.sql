-- Allow Pending in OA archive status for manual correction/editing.

ALTER TABLE online_assessment_records
  DROP CONSTRAINT IF EXISTS ck_oa_records_result;

ALTER TABLE online_assessment_records
  ADD CONSTRAINT ck_oa_records_result CHECK (oa_result IN ('Pending', 'Completed', 'Missed'));
