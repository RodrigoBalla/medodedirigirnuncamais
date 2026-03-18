
-- Create a function to assign admin role by email
CREATE OR REPLACE FUNCTION public.assign_admin_by_email(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE email = _email;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', _email;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Assign admin role
SELECT public.assign_admin_by_email('ocriativomarketing@gmail.com');
