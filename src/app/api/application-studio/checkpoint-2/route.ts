import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPackage, updatePackage } from '@/lib/data/application-studio';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { package_id, edits } = await req.json();
  if (!package_id) return NextResponse.json({ error: 'package_id required' }, { status: 400 });

  const pkg = await getPackage(supabase, package_id, user.id);
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  if (pkg.status !== 'checkpoint_2') {
    return NextResponse.json({ error: `Package is in ${pkg.status} state, expected checkpoint_2` }, { status: 400 });
  }

  await updatePackage(supabase, package_id, user.id, {
    checkpoint_2_edits: edits || {},
    status: 'generating',
  });

  return NextResponse.json({ success: true });
}
