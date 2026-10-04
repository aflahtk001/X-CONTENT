import { NextRequest, NextResponse } from 'next/server';
import { executeRun } from '@/lib/pipeline/run';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
    const expectedSecret = process.env.CRON_SECRET || 'super-secret-cron-token-123';

    if (!token || token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized. Invalid or missing CRON_SECRET bearer token.' }, { status: 401 });
    }

    // Execute run synchronously or catch errors
    const result = await executeRun('schedule');

    return NextResponse.json({
      message: 'Scheduled cron run executed',
      ...result,
    });
  } catch (err: any) {
    if (err.message.includes('currently in progress')) {
      return NextResponse.json({ message: 'Skipped. Another run is currently in progress.' }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
