import { NextRequest, NextResponse } from 'next/server';
import { testGroqConnection } from '@/lib/groq';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const customModel = body.model || undefined;

    const result = await testGroqConnection(customModel);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Groq connection failed' },
      { status: 500 }
    );
  }
}
