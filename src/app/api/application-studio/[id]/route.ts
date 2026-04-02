import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPackage } from '@/lib/data/application-studio';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const pkg = await getPackage(supabase, id, user.id);
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

  return NextResponse.json(pkg);
}
