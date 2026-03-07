ALTER TABLE user_field_visibility
  ADD COLUMN IF NOT EXISTS share_job_application_id BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN user_field_visibility.share_job_application_id IS 'When true (and company/role shared), job/application ID is visible to friends in network today.';
