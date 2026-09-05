-- Phase 19: Entity Settings and Configurable Collection Policies

-- 1. Add configuration columns to business_entities
ALTER TABLE public.business_entities
ADD COLUMN IF NOT EXISTS default_payment_terms_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS invoice_number_format TEXT DEFAULT '{{prefix}}-{{number}}',
ADD COLUMN IF NOT EXISTS financial_year_start_month INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS default_tax_behavior TEXT DEFAULT 'exclusive',
ADD COLUMN IF NOT EXISTS collection_friendly_reminder_days INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS collection_due_date_reminder_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS collection_overdue_reminder_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS collection_second_reminder_days INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS collection_escalation_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS collection_minimum_contact_interval_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb,
ADD COLUMN IF NOT EXISTS weekend_policy TEXT DEFAULT 'previous_business_day',
ADD COLUMN IF NOT EXISTS email_signature TEXT,
ADD COLUMN IF NOT EXISTS logo_path TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state_region TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- 2. Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES public.business_entities(id) ON DELETE CASCADE NOT NULL,
    template_type TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, template_type)
);

-- 3. Enable RLS on email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates of their entities" ON public.email_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.business_entities e
            WHERE e.id = email_templates.entity_id
            AND public.is_business_member(e.business_id)
        )
    );

CREATE POLICY "Owners and admins can manage templates" ON public.email_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.business_entities e
            WHERE e.id = email_templates.entity_id
            AND public.has_business_role(e.business_id, ARRAY['owner'::business_role, 'admin'::business_role])
        )
    );

-- 4. Create trigger function to seed templates
CREATE OR REPLACE FUNCTION public.seed_default_email_templates()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.email_templates (entity_id, template_type, subject, body)
    VALUES
    (NEW.id, 'friendly', 'Friendly Reminder: Invoice {{invoice_number}} from {{entity_name}}', 'Hi {{customer_name}},<br><br>Just a friendly reminder that invoice {{invoice_number}} for {{outstanding_amount}} is due on {{due_date}}.<br><br>Thank you!'),
    (NEW.id, 'due', 'Invoice {{invoice_number}} is due today', 'Hi {{customer_name}},<br><br>This is a reminder that invoice {{invoice_number}} for {{outstanding_amount}} is due today.<br><br>Please let us know if you have any questions.'),
    (NEW.id, 'overdue', 'OVERDUE: Invoice {{invoice_number}}', 'Hi {{customer_name}},<br><br>Your invoice {{invoice_number}} for {{outstanding_amount}} is now overdue (was due on {{due_date}}).<br><br>Please arrange payment as soon as possible.'),
    (NEW.id, 'promise', 'Following up on your payment promise', 'Hi {{customer_name}},<br><br>We are following up regarding your promise to pay invoice {{invoice_number}} by {{promised_date}}.<br><br>Please confirm if payment has been made.'),
    (NEW.id, 'escalation', 'URGENT: Escalation regarding Invoice {{invoice_number}}', 'Hi {{customer_name}},<br><br>This is an escalated notice regarding invoice {{invoice_number}} which is significantly past due.<br><br>Immediate attention is required to resolve this outstanding balance of {{outstanding_amount}}.');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger
DROP TRIGGER IF EXISTS on_business_entity_created ON public.business_entities;
CREATE TRIGGER on_business_entity_created
    AFTER INSERT ON public.business_entities
    FOR EACH ROW
    EXECUTE FUNCTION public.seed_default_email_templates();

-- 6. Backfill existing entities
INSERT INTO public.email_templates (entity_id, template_type, subject, body)
SELECT id, 'friendly', 'Friendly Reminder: Invoice {{invoice_number}} from {{entity_name}}', 'Hi {{customer_name}},<br><br>Just a friendly reminder that invoice {{invoice_number}} for {{outstanding_amount}} is due on {{due_date}}.<br><br>Thank you!'
FROM public.business_entities
ON CONFLICT (entity_id, template_type) DO NOTHING;

INSERT INTO public.email_templates (entity_id, template_type, subject, body)
SELECT id, 'due', 'Invoice {{invoice_number}} is due today', 'Hi {{customer_name}},<br><br>This is a reminder that invoice {{invoice_number}} for {{outstanding_amount}} is due today.<br><br>Please let us know if you have any questions.'
FROM public.business_entities
ON CONFLICT (entity_id, template_type) DO NOTHING;

INSERT INTO public.email_templates (entity_id, template_type, subject, body)
SELECT id, 'overdue', 'OVERDUE: Invoice {{invoice_number}}', 'Hi {{customer_name}},<br><br>Your invoice {{invoice_number}} for {{outstanding_amount}} is now overdue (was due on {{due_date}}).<br><br>Please arrange payment as soon as possible.'
FROM public.business_entities
ON CONFLICT (entity_id, template_type) DO NOTHING;

INSERT INTO public.email_templates (entity_id, template_type, subject, body)
SELECT id, 'promise', 'Following up on your payment promise', 'Hi {{customer_name}},<br><br>We are following up regarding your promise to pay invoice {{invoice_number}} by {{promised_date}}.<br><br>Please confirm if payment has been made.'
FROM public.business_entities
ON CONFLICT (entity_id, template_type) DO NOTHING;

INSERT INTO public.email_templates (entity_id, template_type, subject, body)
SELECT id, 'escalation', 'URGENT: Escalation regarding Invoice {{invoice_number}}', 'Hi {{customer_name}},<br><br>This is an escalated notice regarding invoice {{invoice_number}} which is significantly past due.<br><br>Immediate attention is required to resolve this outstanding balance of {{outstanding_amount}}.'
FROM public.business_entities
ON CONFLICT (entity_id, template_type) DO NOTHING;
