import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { executeRun } from '@/lib/pipeline/run';

export const dynamic = 'force-dynamic';

// GET /api/runs - List runs (paginated)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    const { data: runs, error, count } = await supabase
      .from('Run')
      .select('*', { count: 'exact' })
      .order('startedAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        runs: runs || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/runs - Start manual run in background
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const postsPerRun = body.postsPerRun ? parseInt(body.postsPerRun, 10) : undefined;

    // Check if another run is running
    const { data: activeRuns } = await supabase
      .from('Run')
      .select('id, startedAt')
      .eq('status', 'running')
      .limit(1);

    if (activeRuns && activeRuns.length > 0) {
      const active = activeRuns[0];
      const ageMs = Date.now() - new Date(active.startedAt).getTime();
      if (ageMs < 15 * 60 * 1000) {
        return NextResponse.json(
          { error: `Run ${active.id} is already in progress. Please wait for it to complete.` },
          { status: 409 }
        );
      }
    }

    // Launch run in background
    let runId: string = '';
    
    // Execute asynchronously
    const runPromise = executeRun('manual', { postsPerRun });

    // Catch errors in background
    runPromise.catch((err) => {
      console.error('[Background Run Error]', err);
    });

    // Wait briefly to get created Run ID or return immediate acceptance
    const checkRun = await supabase
      .from('Run')
      .select('id')
      .eq('status', 'running')
      .order('startedAt', { ascending: false })
      .limit(1)
      .single();

    runId = checkRun.data?.id || 'pending';

    return NextResponse.json({
      message: 'Run initiated successfully',
      runId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
