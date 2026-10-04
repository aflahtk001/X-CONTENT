import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadSettings } from '@/lib/pipeline/run';
import { initializeScheduler } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

// GET /api/settings - Read settings
export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/settings - Update settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const allowedKeys = [
      'schedule_cron',
      'timezone',
      'posts_per_run',
      'max_age_hours',
      'groq_model',
      'tone',
      'brand_hashtags',
      'use_hacker_news',
      'require_image',
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        await supabase
          .from('Setting')
          .upsert({ key, value: body[key] }, { onConflict: 'key' });
      }
    }

    // Reinitialize scheduler if cron or timezone changed
    if (body.schedule_cron !== undefined || body.timezone !== undefined) {
      await initializeScheduler().catch((err) => {
        console.warn('[Scheduler Update Error]', err.message);
      });
    }

    const updated = await loadSettings();
    return NextResponse.json({ settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
