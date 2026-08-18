-- Create ENUMs
CREATE TYPE business_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE payment_status AS ENUM ('draft', 'open', 'partial', 'paid', 'disputed', 'cancelled');
CREATE TYPE collection_stage AS ENUM ('monitoring', 'due_soon', 'overdue', 'promise_pending', 'promise_missed', 'escalated', 'recovery_ready', 'closed');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE document_type AS ENUM ('invoice', 'purchase_order', 'delivery_proof', 'contract', 'payment_proof', 'correspondence', 'other');
CREATE TYPE communication_channel AS ENUM ('email', 'manual');
CREATE TYPE communication_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE communication_category AS ENUM ('payment_promise', 'payment_confirmation', 'payment_delay', 'dispute', 'document_request', 'internal_approval', 'general', 'other');
CREATE TYPE promise_status AS ENUM ('pending', 'kept', 'missed', 'cancelled');
CREATE TYPE action_type AS ENUM ('friendly_reminder', 'due_date_reminder', 'overdue_reminder', 'promise_followup', 'escalation', 'document_request', 'recovery_pack');
CREATE TYPE action_status AS ENUM ('recommended', 'draft', 'approved', 'sent', 'skipped', 'completed', 'failed');

-- Profiles Table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Businesses Table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    legal_name TEXT,
    gstin TEXT,
    udyam_number TEXT,
    default_currency TEXT DEFAULT 'INR',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    country TEXT DEFAULT 'IN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business Members Table
CREATE TABLE business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role business_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, user_id)
);

-- Customers Table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    company_name TEXT,
    primary_email TEXT,
    phone TEXT,
    gstin TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices Table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    payment_terms_days INTEGER,
    currency TEXT DEFAULT 'INR',
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    outstanding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_status payment_status NOT NULL DEFAULT 'open',
    collection_stage collection_stage NOT NULL DEFAULT 'monitoring',
    risk_score INTEGER,
    risk_level risk_level,
    source TEXT,
    extraction_status TEXT,
    extraction_confidence NUMERIC(3, 2),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Documents Table
CREATE TABLE invoice_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    document_type document_type NOT NULL,
    storage_path TEXT NOT NULL,
    original_file_name TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    sha256 TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments Table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_reference TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communications Table
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    channel communication_channel NOT NULL,
    direction communication_direction NOT NULL,
    external_message_id TEXT,
    external_thread_id TEXT,
    from_address TEXT,
    to_addresses TEXT[],
    subject TEXT,
    body_text TEXT,
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    category communication_category,
    category_confidence NUMERIC(3, 2),
    ai_summary TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Promises Table
CREATE TABLE payment_promises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    communication_id UUID REFERENCES communications(id) ON DELETE SET NULL,
    promised_date DATE NOT NULL,
    promised_amount NUMERIC(12, 2),
    reason TEXT,
    confidence NUMERIC(3, 2),
    status promise_status NOT NULL DEFAULT 'pending',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection Actions Table
CREATE TABLE collection_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    action_type action_type NOT NULL,
    status action_status NOT NULL DEFAULT 'recommended',
    recommended_reason TEXT,
    draft_subject TEXT,
    draft_body TEXT,
    scheduled_for TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk Events Table
CREATE TABLE risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    previous_score INTEGER,
    new_score INTEGER NOT NULL,
    risk_level risk_level,
    reasons JSONB,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence Items Table
CREATE TABLE evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    source_type TEXT NOT NULL,
    source_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    event_at TIMESTAMPTZ NOT NULL,
    include_in_recovery BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    entity_type TEXT,
    entity_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_business_members_business_id ON business_members(business_id);
CREATE INDEX idx_business_members_user_id ON business_members(user_id);
CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_invoices_business_id ON invoices(business_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX idx_invoices_collection_stage ON invoices(collection_stage);
CREATE INDEX idx_invoices_risk_score ON invoices(risk_score);
CREATE INDEX idx_invoice_documents_invoice_id ON invoice_documents(invoice_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_communications_business_id ON communications(business_id);
CREATE INDEX idx_communications_invoice_id ON communications(invoice_id);
CREATE INDEX idx_communications_external_message_id ON communications(external_message_id);
CREATE INDEX idx_communications_external_thread_id ON communications(external_thread_id);
CREATE INDEX idx_payment_promises_invoice_id ON payment_promises(invoice_id);
CREATE INDEX idx_collection_actions_invoice_id ON collection_actions(invoice_id);
CREATE INDEX idx_collection_actions_status ON collection_actions(status);
CREATE INDEX idx_risk_events_invoice_id ON risk_events(invoice_id);
CREATE INDEX idx_evidence_items_invoice_id ON evidence_items(invoice_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
