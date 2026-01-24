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
 * 2. Check if tomorrow's challenge already exists
 * 3. Select random perfume from eligible pool (not used in last 30 days)
 * 4. Insert new daily_challenge record
 * 5. Return success/failure status
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
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const tomorrowDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

        // 2. Check if challenge already exists for tomorrow
        const { data: existingChallenge } = await adminSupabase
            .from('daily_challenges')
            .select('id')
            .eq('challenge_date', tomorrowDate)
            .single();

        if (existingChallenge) {
            console.log(`[CRON] Challenge for ${tomorrowDate} already exists`);
            return NextResponse.json({
                status: 'skipped',
                message: 'Challenge already exists',
                date: tomorrowDate
            });
        }

        // 3. Get recently used perfume IDs (last 365 days = 1 year)
        const oneYearAgo = new Date();
        oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 365);
        const { data: recentChallenges } = await adminSupabase
            .from('daily_challenges')
            .select('perfume_id')
            .gte('challenge_date', oneYearAgo.toISOString().split('T')[0]);

        const usedPerfumeIds = recentChallenges?.map(c => c.perfume_id) || [];

        // 4. Select random perfume from eligible pool
        // 4. Select random perfume from eligible pool
        // Eligible = has assets + not used recently + is_active

        const fetchCandidates = async (excludeIds: string[]) => {
            let query = adminSupabase
                .from('perfume_assets')
                .select('perfume_id, perfumes!inner(is_uncertain)')
                .not('image_key_step_1', 'is', null) // Must have at least step 1 image
                .eq('perfumes.is_uncertain', false); // Only certain perfumes

            if (excludeIds.length > 0) {
                query = query.not('perfume_id', 'in', `(${excludeIds.join(',')})`);
            }
            return await query;
        };

        // Attempt 1: Strict (exclude last 365 days)
        let { data: eligiblePerfumes, error: eligibleError } = await fetchCandidates(usedPerfumeIds);

        // Attempt 2: Fallback (exclude last 7 days only)
        if (!eligibleError && (!eligiblePerfumes || eligiblePerfumes.length === 0)) {
            console.warn('[CRON] No fresh perfumes found (365 days). Switching to fallback mode (7 days exclusion).');

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
            const { data: recentChallenges7d } = await adminSupabase
                .from('daily_challenges')
                .select('perfume_id')
                .gte('challenge_date', sevenDaysAgo.toISOString().split('T')[0]);

            const usedLast7Days = recentChallenges7d?.map(c => c.perfume_id) || [];

            const fallbackResult = await fetchCandidates(usedLast7Days);
            eligiblePerfumes = fallbackResult.data;
            eligibleError = fallbackResult.error;
        }

        if (eligibleError || !eligiblePerfumes || eligiblePerfumes.length === 0) {
            console.error('[CRON] No eligible perfumes found even after fallback:', eligibleError);
            return NextResponse.json(
                { error: 'No eligible perfumes available' },
                { status: 500 }
            );
        }

        // Random selection
        const selectedPerfume = eligiblePerfumes[Math.floor(Math.random() * eligiblePerfumes.length)];

        // 5. Get current max challenge_number
        const { data: maxChallenge } = await adminSupabase
            .from('daily_challenges')
            .select('challenge_number')
            .order('challenge_number', { ascending: false })
            .limit(1)
            .single();

        const nextChallengeNumber = (maxChallenge?.challenge_number || 0) + 1;

        // 6. Insert new challenge
        const graceDeadline = new Date(tomorrow);
        graceDeadline.setUTCHours(23, 59, 59, 999); // End of tomorrow

        const { data: newChallenge, error: insertError } = await adminSupabase
            .from('daily_challenges')
            .insert({
                perfume_id: selectedPerfume.perfume_id,
                challenge_date: tomorrowDate,
                challenge_number: nextChallengeNumber,
                mode: 'standard',
                seed_hash: `auto-${Date.now()}`,
                grace_deadline_at_utc: graceDeadline.toISOString(),
                snapshot_metadata: {}
            })
            .select()
            .single();

        if (insertError) {
            console.error('[CRON] Failed to insert challenge:', insertError);
            return NextResponse.json(
                { error: 'Database insertion failed', details: insertError.message },
                { status: 500 }
            );
        }

        console.log(`[CRON] ✅ Generated challenge #${nextChallengeNumber} for ${tomorrowDate}`);

        return NextResponse.json({
            status: 'success',
            challenge: {
                id: newChallenge.id,
                challenge_number: nextChallengeNumber,
                challenge_date: tomorrowDate
            }
        });

    } catch (error) {
        console.error('[CRON] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
