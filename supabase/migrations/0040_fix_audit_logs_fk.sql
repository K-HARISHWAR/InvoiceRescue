-- Add foreign key constraint to link audit_logs directly to profiles
-- This allows PostgREST to automatically resolve joins like actor:profiles(full_name)
ALTER TABLE audit_logs
ADD CONSTRAINT fk_audit_logs_profile
FOREIGN KEY (actor_user_id)
REFERENCES profiles(id)
ON DELETE SET NULL;
