-- Fix foreign key so PostgREST can join profiles

ALTER TABLE public.customer_notes
DROP CONSTRAINT IF EXISTS customer_notes_user_id_fkey;

ALTER TABLE public.customer_notes
ADD CONSTRAINT customer_notes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
