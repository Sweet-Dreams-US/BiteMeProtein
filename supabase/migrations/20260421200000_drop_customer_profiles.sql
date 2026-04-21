-- 20260421200000_drop_customer_profiles.sql
-- Removes the customer_profiles table. The /account customer-login feature
-- that backed this table was removed in favor of the guest-only flow
-- (/rewards + /track cover returning-customer needs without requiring
-- anyone to sign up). Supabase Auth users for customers are no longer
-- created, so the profiles table is dead weight.
--
-- Policies are owned by the table, so `drop table cascade` removes them
-- automatically along with any lingering constraints.

drop table if exists public.customer_profiles cascade;
