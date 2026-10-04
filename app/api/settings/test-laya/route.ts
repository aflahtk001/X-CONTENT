import { NextResponse } from 'next/server';
import { checkLayaHealth } from '@/lib/laya';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const isHealthy = await checkLayaHealth();
    if (isHealthy) {
      return NextResponse.json({
        success: true,
        message: 'Laya Decision Engine is running and healthy on http://127.0.0.1:8000',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not connect to Laya Decision Engine at http://127.0.0.1:8000. Ensure laya_server.py is running.',
        },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err.message,
      },
      { status: 500 }
    );
  }
}
