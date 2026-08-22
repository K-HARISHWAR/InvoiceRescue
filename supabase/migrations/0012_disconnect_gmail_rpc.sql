CREATE OR REPLACE FUNCTION disconnect_gmail(p_business_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verify the user is an owner or admin of the business
  SELECT role INTO v_role
  FROM business_members
  WHERE business_id = p_business_id AND user_id = auth.uid();
  
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can disconnect Gmail.';
  END IF;

  DELETE FROM gmail_connections
  WHERE business_id = p_business_id;
END;
$$;
