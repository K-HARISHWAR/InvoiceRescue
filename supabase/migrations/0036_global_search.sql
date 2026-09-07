-- Add po_number to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Create global search RPC
CREATE OR REPLACE FUNCTION global_search(p_business_id UUID, p_query TEXT)
RETURNS TABLE (
  result_type TEXT,
  id UUID,
  title TEXT,
  subtitle TEXT,
  url TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  -- Search Invoices
  SELECT 
    'invoice'::TEXT AS result_type,
    i.id,
    COALESCE(i.invoice_number, 'Draft') AS title,
    c.name AS subtitle,
    '/app/invoices/' || i.id AS url
  FROM invoices i
  LEFT JOIN customers c ON i.customer_id = c.id
  WHERE i.business_id = p_business_id
    AND (
      i.invoice_number ILIKE '%' || p_query || '%'
      OR i.po_number ILIKE '%' || p_query || '%'
      OR c.name ILIKE '%' || p_query || '%'
      OR c.primary_email ILIKE '%' || p_query || '%'
    )
  
  UNION ALL
  
  -- Search Customers
  SELECT 
    'customer'::TEXT AS result_type,
    c.id,
    c.name AS title,
    c.primary_email AS subtitle,
    '/app/customers/' || c.id AS url
  FROM customers c
  WHERE c.business_id = p_business_id
    AND (
      c.name ILIKE '%' || p_query || '%'
      OR c.primary_email ILIKE '%' || p_query || '%'
    );
END;
$$;
