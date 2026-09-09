-- Ensure actor_user_id can be null (which it should be by default, but enforcing it to fix strict constraint errors)
ALTER TABLE audit_logs ALTER COLUMN actor_user_id DROP NOT NULL;
