-- Enable password strength and leaked password protection
-- This helps protect users by enforcing strong passwords and checking against known leaked passwords
UPDATE auth.config SET 
  password_min_length = 8,
  password_require_special_chars = true,
  password_require_numbers = true,
  password_require_letters = true,
  hibp_enabled = true;