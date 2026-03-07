ALTER TABLE jobs ALTER COLUMN job_application_id DROP NOT NULL;

UPDATE jobs SET job_application_id = NULL WHERE job_application_id = '-';
