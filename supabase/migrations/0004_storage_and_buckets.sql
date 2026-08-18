-- Insert private buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoice-documents', 'invoice-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('recovery-packs', 'recovery-packs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for invoice-documents
CREATE POLICY "Members can access their business documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'invoice-documents' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);

CREATE POLICY "Members can upload their business documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'invoice-documents' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);

CREATE POLICY "Members can update their business documents"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'invoice-documents' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);

CREATE POLICY "Members can delete their business documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'invoice-documents' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);

-- Storage RLS Policies for recovery-packs
CREATE POLICY "Members can access their business recovery packs"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'recovery-packs' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);

CREATE POLICY "Members can upload their business recovery packs"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'recovery-packs' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);

CREATE POLICY "Members can update their business recovery packs"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'recovery-packs' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);

CREATE POLICY "Members can delete their business recovery packs"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'recovery-packs' AND
    is_business_member((string_to_array(name, '/'))[1]::uuid)
);
