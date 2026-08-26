export interface ExtractedInvoiceData {
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  payment_terms_days?: number | null;
  currency?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  purchase_order?: string | null;
  confidence?: number;
  warnings?: string[];
}

export interface DocumentDetails {
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
}
