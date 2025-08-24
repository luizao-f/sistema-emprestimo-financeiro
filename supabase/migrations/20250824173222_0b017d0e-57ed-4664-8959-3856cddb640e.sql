-- Fix function search path security issue
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE recebimentos 
  SET status = 'atrasado' 
  WHERE data_vencimento < CURRENT_DATE 
    AND status = 'pendente' 
    AND data_recebimento IS NULL;
END;
$$;