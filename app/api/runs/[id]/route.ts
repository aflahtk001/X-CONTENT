import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/runs/:id - Run detail with logs and clusters
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const { data: run, error } = await supabase
      .from('Run')
      .select('*, clusters:Cluster(*)')
      .eq('id', id)
      .single();

    if (error || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
