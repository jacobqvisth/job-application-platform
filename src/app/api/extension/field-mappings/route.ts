import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/supabase/extension-auth';
import { getPrimaryMarket } from '@/lib/data/markets';
import { getMarketConfig, DEFAULT_MARKET } from '@/lib/markets';
import type { UpsertFormFieldMapping } from '@/lib/types/database';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const auth = await getExtensionUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const { userId, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const atsType = searchParams.get('ats_type');

  const VALID_ATS_TYPES = ['workday', 'greenhouse', 'lever', 'varbi', 'teamtailor', 'jobylon', 'reachmee'];
  if (!atsType || !VALID_ATS_TYPES.includes(atsType)) {
    return NextResponse.json(
      { error: `ats_type must be one of: ${VALID_ATS_TYPES.join(', ')}` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const [{ data: mappings, error }, primaryMarket] = await Promise.all([
    supabase
      .from('form_field_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('ats_type', atsType),
    getPrimaryMarket(supabase, userId),
  ]);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500, headers: CORS_HEADERS });
  }

  const marketCode = primaryMarket?.market_code ?? DEFAULT_MARKET;
  const marketConfig = getMarketConfig(marketCode);

  // Market-specific field hints for the extension
  const marketFieldHints: Record<string, string> = {};
  if (marketCode === 'SE') {
    marketFieldHints['postal_code'] = 'postal_code';
  } else {
    marketFieldHints['zip_code'] = 'postal_code';
    marketFieldHints['zip'] = 'postal_code';
  }

  return NextResponse.json(
    {
      success: true,
      mappings: mappings ?? [],
      marketCode,
      marketFieldHints,
      coverLetterName: marketConfig?.applicationNorms.coverLetterName ?? 'Cover Letter',
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  const auth = await getExtensionUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const { userId, supabase } = auth;

  let body: UpsertFormFieldMapping;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
  }

  if (!body.ats_type || !body.field_identifier || !body.profile_key) {
    return NextResponse.json(
      { error: 'ats_type, field_identifier, and profile_key are required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { data: existing } = await supabase
    .from('form_field_mappings')
    .select('correction_count')
    .eq('user_id', userId)
    .eq('ats_type', body.ats_type)
    .eq('field_identifier', body.field_identifier)
    .maybeSingle();

  const correctionCount = body.is_user_corrected
    ? (existing?.correction_count ?? 0) + 1
    : existing?.correction_count ?? 0;

  const { data: mapping, error } = await supabase
    .from('form_field_mappings')
    .upsert(
      {
        user_id: userId,
        ats_type: body.ats_type,
        field_identifier: body.field_identifier,
        profile_key: body.profile_key,
        is_user_corrected: body.is_user_corrected,
        correction_count: correctionCount,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,ats_type,field_identifier' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to save mapping' }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json({ success: true, mapping }, { headers: CORS_HEADERS });
}
