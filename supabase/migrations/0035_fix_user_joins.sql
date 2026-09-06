-- Add email to profiles for easy joining
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert any missing profiles for existing auth users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Update existing profiles
UPDATE profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id;

-- Add foreign keys to allow PostgREST to join across tables
ALTER TABLE business_members DROP CONSTRAINT IF EXISTS fk_bm_profile;
ALTER TABLE business_members ADD CONSTRAINT fk_bm_profile FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE collection_actions DROP CONSTRAINT IF EXISTS fk_ca_assigned_profile;
ALTER TABLE collection_actions ADD CONSTRAINT fk_ca_assigned_profile FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE collection_actions DROP CONSTRAINT IF EXISTS fk_ca_assigned_by_profile;
ALTER TABLE collection_actions ADD CONSTRAINT fk_ca_assigned_by_profile FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE action_comments DROP CONSTRAINT IF EXISTS fk_ac_profile;
ALTER TABLE action_comments ADD CONSTRAINT fk_ac_profile FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE saved_views DROP CONSTRAINT IF EXISTS fk_sv_profile;
ALTER TABLE saved_views ADD CONSTRAINT fk_sv_profile FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
