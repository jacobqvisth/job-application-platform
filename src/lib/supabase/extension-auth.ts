import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

// Validates a bearer token from the extension and returns the userId + a scoped supabase client.
// Uses createServerClient (same as the rest of the app) with an empty cookie adapter and
// the Authorization header set to the user's JWT, so RLS applies correctly.
export async function getExtensionUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  return { userId: user.id, supabase };
}
