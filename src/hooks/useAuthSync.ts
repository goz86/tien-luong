import { useEffect } from 'react';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

/**
 * Manages Supabase auth session: initial load + onAuthStateChange listener.
 */
export function useAuthSync() {
  const setSession = useAppStore((s) => s.setSession);
  const setAdminRole = useAppStore((s) => s.setAdminRole);
  const session = useAppStore((s) => s.session);

  // Auth state
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  // Admin role
  useEffect(() => {
    if (!supabase || !session) {
      setAdminRole(null);
      return;
    }

    let mounted = true;
    supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setAdminRole(data?.role || null);
      });

    return () => { mounted = false; };
  }, [session, setAdminRole]);
}
