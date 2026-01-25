import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Vercel Cron Job: Generate Daily Challenge
 * 
 * Schedule: 0 0 * * * (Daily at midnight UTC)
 * 
 * Security: Requires Authorization header with CRON_SECRET
 * 
 * Logic:
 * 1. Verify authorization
 * 2. Self-Healing: Check if TODAY's challenge exists. If not, generate it.
 * 3. Future-Proofing: Check if TOMORROW's challenge exists. If not, generate it.
 */
export async function GET(request: NextRequest) {
    // 1. Security Check: Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error('[CRON] CRON_SECRET not configured');
        return NextResponse.json(
            { error: 'Server misconfiguration' },
            { status: 500 }
        );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('[CRON] Unauthorized access attempt');
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const adminSupabase = createAdminClient();
        const results = [];

        // Check TODAY (Self-Healing)
        const todayStr = new Date().toISOString().split('T')[0];
        results.push(await ensureChallenge(adminSupabase, todayStr));

        // Check TOMORROW (Standard)
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        results.push(await ensureChallenge(adminSupabase, tomorrowStr));

        return NextResponse.json({
            status: 'success',
            results
        });

    } catch (error) {
        console.error('[CRON] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

async function ensureChallenge(supabase: any, dateStr: string) {
    // 1. Check if exists
    const { data: existing } = await supabase
        .from('daily_challenges')
        .select('id, challenge_number, perfume_id')
        .eq('challenge_date', dateStr)
        .single();

    if (existing) {
        return { date: dateStr, status: 'exists', id: existing.id };
    }

    console.log(`[CRON] Generating missing challenge for ${dateStr}...`);

    // 2. Fetch exclusion list (Last 30 days is sufficient to avoid recent repeats, keeping pool healthy)
    const exclusionDate = new Date();
    exclusionDate.setUTCDate(exclusionDate.getUTCDate() - 30);

    const { data: recentChallenges } = await supabase
        .from('daily_challenges')
        .select('perfume_id')
        .gte('challenge_date', exclusionDate.toISOString().split('T')[0]);

    const excludeIds = recentChallenges?.map((c: any) => c.perfume_id) || [];

    // 3. Fetch Candidates
    let query = supabase
        .from('perfume_assets')
        .select('perfume_id, perfumes!inner(is_uncertain)')
        .not('image_key_step_1', 'is', null) // Must have assets
        .eq('perfumes.is_uncertain', false); // Must be verified

    if (excludeIds.length > 0) {
        query = query.not('perfume_id', 'in', `(${excludeIds.join(',')})`);
    }

    let { data: candidates, error } = await query;

    // Fallback: If pool exhausted (unlikely), try excluding only last 7 days
    if (error || !candidates || candidates.length === 0) {
        console.warn(`[CRON] Pool exhausted for ${dateStr}. Retrying with 7-day exclusion.`);

        const shortExclusionDate = new Date();
        shortExclusionDate.setUTCDate(shortExclusionDate.getUTCDate() - 7);
        const { data: recent7 } = await supabase
            .from('daily_challenges')
            .select('perfume_id')
            .gte('challenge_date', shortExclusionDate.toISOString().split('T')[0]);

        const excludeIds7 = recent7?.map((c: any) => c.perfume_id) || [];

        let retryQuery = supabase
            .from('perfume_assets')
            .select('perfume_id, perfumes!inner(is_uncertain)')
            .not('image_key_step_1', 'is', null)
            .eq('perfumes.is_uncertain', false);

        if (excludeIds7.length > 0) {
            retryQuery = retryQuery.not('perfume_id', 'in', `(${excludeIds7.join(',')})`);
        }

        const retryResult = await retryQuery;
        candidates = retryResult.data;
        error = retryResult.error;
    }

    if (error || !candidates || candidates.length === 0) {
        throw new Error(`No eligible perfumes found for ${dateStr}. Error: ${error?.message}`);
    }

    // 4. Random Selection
    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    // 5. Get Next Challenge Number
    const { data: maxChallenge } = await supabase
        .from('daily_challenges')
        .select('challenge_number')
        .order('challenge_number', { ascending: false })
        .limit(1)
        .single();

    const nextNumber = (maxChallenge?.challenge_number || 0) + 1;

    // 6. Insert
    const deadline = new Date(dateStr);
    deadline.setUTCHours(23, 59, 59, 999);

    const { data: newChallenge, error: insertError } = await supabase
        .from('daily_challenges')
        .insert({
            perfume_id: selected.perfume_id,
            challenge_date: dateStr,
            challenge_number: nextNumber,
            mode: 'standard',
            seed_hash: `auto-${Date.now()}`,
            grace_deadline_at_utc: deadline.toISOString(),
            snapshot_metadata: {}
        })
        .select()
        .single();

    if (insertError) {
        throw new Error(`Failed to insert challenge for ${dateStr}: ${insertError.message}`);
    }

    console.log(`[CRON] ✅ Created challenge #${nextNumber} for ${dateStr}`);
    return { date: dateStr, status: 'created', id: newChallenge.id, perfume_id: selected.perfume_id };
}
