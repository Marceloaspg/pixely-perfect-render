import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { isAuthenticationRejection, SupabaseServiceUnavailableError } from '@/lib/admin-access';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isAuthenticationRejection(error)) throw redirect({ to: '/auth' });
      console.error('[Supabase auth] Session check failed.', {
        errorType: error instanceof Error ? error.name : 'unknown',
      });
      throw new SupabaseServiceUnavailableError();
    }
    if (!data.user) throw redirect({ to: '/auth' });
  },
  component: () => <Outlet />,
});
