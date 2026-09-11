-- Legacy guest accounts predate the is_guest flag.
--
-- They were created by guest checkout with a random throwaway password, so
-- their owners cannot log in — yet the "already registered, please log in"
-- guard treated them as registrations and blocked those people from booking
-- again with their own email or phone.
--
-- Nothing in the data distinguishes them from a real registration (the audit
-- log is empty and email_verified is false for everyone), so we flag every
-- pre-existing customer. Staff, admin and super_admin rows are untouched:
-- those are real accounts with real passwords.
--
-- If any customer here did register properly, undo that single row with:
--   UPDATE users SET is_guest = false WHERE email = 'their@email.com';
UPDATE "users"
SET "is_guest" = true
WHERE "role" = 'customer'
  AND "is_guest" = false;
