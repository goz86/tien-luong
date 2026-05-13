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
    let mounted = true;

    const restoreSession = async (clearWhenMissing = false) => {
      const { data, error } = await client.auth.getSession();
      if (!mounted) return;
      if (error) {
        console.warn('Unable to restore Supabase session:', error.message);
        return;
      }

      if (data.session) {
        setSession(data.session);
        return;
      }

      if (clearWhenMissing) {
        setSession(null);
      }
    };

    void restoreSession(true);

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      if (nextSession) {
        setSession(nextSession);
        return;
      }

      if (_event === 'SIGNED_OUT') {
        setSession(null);
      }
    });

    const recoverActiveSession = () => {
      void restoreSession(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') recoverActiveSession();
    };

    window.addEventListener('focus', recoverActiveSession);
    window.addEventListener('online', recoverActiveSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', recoverActiveSession);
      window.removeEventListener('online', recoverActiveSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
