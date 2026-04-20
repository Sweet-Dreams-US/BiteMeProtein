"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface CustomerProfile {
  user_id: string;
  email: string;
  phone: string | null;
  square_customer_id: string | null;
  created_at: string;
  last_signin_at: string | null;
}

interface UseCurrentCustomer {
  user: User | null;
  profile: CustomerProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

/**
 * Hook for customer-facing pages. Returns the currently-signed-in Supabase
 * Auth user plus their customer_profiles row (if it exists).
 *
 * Distinct from admin auth — admins sign in at /admin/login with email +
 * password; customers sign in at /account/login with magic-link. Both use
 * the same Supabase Auth backend but profiles live in separate tables.
 *
 * Returns { user: null, profile: null } for signed-out visitors without
 * triggering a redirect — let the caller decide what to show (e.g.,
 * signed-out view or redirect to /account/login).
 */
export function useCurrentCustomer(): UseCurrentCustomer {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session.user);

      const { data: profileRow } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;
      setProfile((profileRow as CustomerProfile) ?? null);
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setProfile(null);
      } else {
        setUser(session.user);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, profile, loading, signOut };
}
