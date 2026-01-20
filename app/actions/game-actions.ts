'use server'


import { createClient, createAdminClient } from '@/lib/supabase/server';

import { revalidatePath } from 'next/cache';
import { calculateBaseScore, calculateFinalScore, getRevealPercentages, revealLetters } from '@/lib/game/scoring';
import { type GameResult, type RevealState } from '@/lib/game/scoring';
import { trackEvent, identifyUser } from '@/lib/analytics-server';

// --- Types ---

export interface DailyChallenge {
    id: string;
    challenge_date: string;
    mode: string;
    grace_deadline_at_utc: string;
    snapshot_metadata: any;
    // NO perfume_id exposed here!
}

export interface StartGameResponse {
    sessionId: string;
    nonce: string; // serialized 64-bit int (string to avoid JS precision loss)
    imageUrl: string | null;
    revealState: RevealState;
    graceDeadline: string;
}

export interface GuessResult {
    result: 'correct' | 'incorrect';
    newNonce: string;
    imageUrl?: string | null;
    revealState: RevealState;
    gameStatus: 'active' | 'won' | 'lost';
    finalScore?: number;
    message?: string;
    feedback?: {
        year?: string;
        brand?: string; // Partial reveal
        perfumer?: string; // Partial reveal
        gender?: boolean;
    }
}

// --- Helpers ---

/**
 * Generates a crypto-safe 64-bit signed integer for use as a nonce.
 * Returns it as a string to preserve precision in JS.
 * Postgres `bigint` is signed 64-bit.
 */
function generateNonce(): string {
    // We need a 64-bit integer. JS crypto.getRandomValues supports BigInt64Array since reasonably modern Node/Browsers.
    // Next.js 16 (Node 18+) definitely supports it.
    const array = new BigInt64Array(1);
    crypto.getRandomValues(array);
    return array[0].toString();
}

// --- Actions ---

export async function getDailyChallenge(): Promise<DailyChallenge | null> {
    const supabase = await createClient();

    // We query the PUBLIC view, which explicitly excludes perfume_id
    const { data, error } = await supabase
        .from('daily_challenges_public')
        .select('*')
        .eq('challenge_date', new Date().toISOString().split('T')[0]) // Today UTC
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // No challenge found
        console.error('Error fetching daily challenge:', error);
        throw new Error('Failed to fetch daily challenge');
    }

    return data as DailyChallenge;
}

export async function startGame(challengeId: string): Promise<StartGameResponse> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // Check if session already exists
    const { data: existingSession } = await supabase
        .from('game_sessions')
        .select('id, last_nonce, attempts_count')
        .eq('player_id', user.id)
        .eq('challenge_id', challengeId)
        .eq('status', 'active')
        .single();

    if (existingSession) {
        // RESUME EXISTING SESSION
        const graceQuery = await supabase
            .from('daily_challenges_public')
            .select('grace_deadline_at_utc')
            .eq('id', challengeId)
            .single();

        const imageUrl = await getImageUrlForStep(existingSession.id);

        return {
            sessionId: existingSession.id,
            nonce: String(existingSession.last_nonce),
            imageUrl: imageUrl,
            revealState: getRevealPercentages(existingSession.attempts_count + 1),
            graceDeadline: graceQuery.data?.grace_deadline_at_utc
        };
    }

    // ... New Session Logic ...

    const nonce = generateNonce();

    // 1. Insert Session
    const { data: session, error: insertError } = await supabase
        .from('game_sessions')
        .insert({
            player_id: user.id,
            challenge_id: challengeId,
            start_time: new Date().toISOString(),
            last_nonce: nonce, // Store as string/bigint
            status: 'active',
            attempts_count: 0
        })
        .select()
        .single();

    if (insertError) {
        console.error('Error starting game:', insertError);
        throw new Error(`Failed to start game session: ${insertError.message} (${insertError.details || insertError.hint || 'no details'})`);
    }

    // 2. Fetch Image (Securely)
    const imageUrl = await getImageUrlForStep(session.id);

    // Track Game Start
    const { data: challengeData } = await supabase
        .from('daily_challenges_public')
        .select('mode')
        .eq('id', challengeId)
        .single();

    await identifyUser(user.id);
    await trackEvent('game_started', {
        challenge_id: challengeId,
        mode: challengeData?.mode || 'daily', // Fallback defaults
        session_id: session.id
    }, user.id);

    const graceQuery = await supabase
        .from('daily_challenges_public')
        .select('grace_deadline_at_utc')
        .eq('id', challengeId)
        .single();

    return {
        sessionId: session.id,
        nonce: nonce,
        imageUrl: imageUrl,
        revealState: getRevealPercentages(1),
        graceDeadline: graceQuery.data?.grace_deadline_at_utc
    };
}

export async function getImageUrlForStep(sessionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Get Session (User RLS)
    const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('challenge_id, attempts_count, player_id')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session) throw new Error('Session not found');
    if (session.player_id !== user.id) throw new Error('Unauthorized');

    // 2. Get Challenge's Perfume ID (Admin - Secure)
    const adminSupabase = createAdminClient();
    const { data: challenge } = await adminSupabase
        .from('daily_challenges')
        .select('perfume_id')
        .eq('id', session.challenge_id)
        .single();

    if (!challenge) throw new Error('Challenge not found');

    // 3. Get Assets (Admin or Public)
    const { data: assets } = await adminSupabase
        .from('perfume_assets')
        .select('asset_random_id, image_key_step_1, image_key_step_2, image_key_step_3, image_key_step_4, image_key_step_5, image_key_step_6')
        .eq('perfume_id', challenge.perfume_id)
        .single();

    if (!assets) {
        // Fallback for dev/missing assets
        console.warn(`No assets found for perfume ${challenge.perfume_id}`);
        return "https://placehold.co/512x512?text=No+Asset";
    }

    // 4. Determine Step
    // attempts=0 -> Step 1
    // attempts=1 -> Step 2
    // ...
    // attempts>=5 -> Step 6 (Reveal)
    const step = Math.min(session.attempts_count + 1, 6);
    const key = assets[`image_key_step_${step}` as keyof typeof assets];

    // Use environment variable for assets host, fallback to example if not set
    const assetsHost = process.env.NEXT_PUBLIC_ASSETS_HOST || 'assets.eauxle.com';
    return `https://${assetsHost}/${key}`;
}

// Helper for startGame to avoid double-fetching session if not needed, 
// but reusing the logic verifies everything.
// Actually, startGame has the session object already, but `getImageUrlForStep` takes ID.
// We can optimize or just call it. For safety/consistency, calling the function is fine.



export async function submitGuess(
    sessionId: string,
    perfumeId: string,
    clientNonce: string
): Promise<GuessResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Fetch Session (as User - enforces RLS ownership)
    // CRITICAL: Do NOT join 'daily_challenges' here, as it triggers RLS "permission denied" for secure columns.
    const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session) {
        console.error('Submit Guess Session Error:', sessionError);
        const details = sessionError ? `${sessionError.message} (${sessionError.details || sessionError.hint || 'no details'})` : 'No session returned';
        throw new Error(`Session not found or permission denied: ${details}`);
    }

    // 2. Optimistic Locking Check
    if (String(session.last_nonce) !== String(clientNonce)) {
        throw new Error(`CONFLICT:${session.last_nonce}`);
    }

    if (session.status !== 'active') {
        return {
            result: 'incorrect',
            newNonce: String(session.last_nonce),
            revealState: getRevealPercentages(6),
            gameStatus: session.status as any
        };
    }

    // 3. Fetch Challenge "Secret" Data (as Admin - bypasses RLS)
    // We utilize the Admin Client specifically to check the answer (perfume_id)
    // without exposing it to the User Client (which respects RLS).
    const adminSupabase = createAdminClient();
    const { data: challenge, error: challengeError } = await adminSupabase
        .from('daily_challenges')
        .select('perfume_id, grace_deadline_at_utc')
        .eq('id', session.challenge_id)
        .single();

    if (challengeError || !challenge) {
        console.error('Challenge Fetch Error (Admin):', challengeError);
        throw new Error('Failed to verify challenge data');
    }

    const isCorrect = (perfumeId === challenge.perfume_id);
    const currentAttempts = session.attempts_count;
    const nextAttempts = currentAttempts + 1;
    const isGameOver = isCorrect || nextAttempts >= 6;

    // 4. Update Session (as User - enforces RLS ownership)
    const newNonce = generateNonce();

    // Append guess to history
    const guessEntry = {
        perfumeId,
        timestamp: new Date().toISOString(),
        isCorrect
    };

    const { data: updatedSession, error: updateError } = await supabase
        .from('game_sessions')
        .update({
            attempts_count: nextAttempts,
            last_nonce: newNonce,
            last_guess: new Date().toISOString(),
            guesses: [...(session.guesses as any[] || []), guessEntry], // Cast for JSONB
            status: isGameOver ? (isCorrect ? 'won' : 'lost') : 'active'
        })
        .eq('id', sessionId)
        .eq('last_nonce', clientNonce)
        .select()
        .single();

    if (updateError || !updatedSession) {
        throw new Error(`CONFLICT:${session.last_nonce}`);
    }

    // Track Guess
    await trackEvent('guess_submitted', {
        session_id: sessionId,
        challenge_id: session.challenge_id,
        attempt_number: nextAttempts,
        is_correct: isCorrect,
        perfume_id: perfumeId
    }, user.id);

    // 5. Finalize Game if Over
    let finalScore = 0;
    if (isGameOver) {
        // Fetch Target Perfume Data using Admin Client to ensure we can get xsolve_score
        const { data: targetPerfume } = await adminSupabase
            .from('perfumes')
            .select('xsolve_score')
            .eq('id', challenge.perfume_id)
            .single();

        const xScore = targetPerfume?.xsolve_score || 0;
        const baseScore = isCorrect ? calculateBaseScore(nextAttempts) : 0;
        finalScore = isCorrect ? calculateFinalScore(baseScore, xScore) : 0;

        const now = new Date();
        const deadline = new Date(challenge.grace_deadline_at_utc);
        const isRanked = now <= deadline;
        const rankedReason = isRanked ? null : 'after_grace';

        // Insert Result (as User - requires RLS INSERT on game_results)
        await supabase.from('game_results').insert({
            challenge_id: session.challenge_id,
            player_id: user.id,
            session_id: sessionId,
            status: isCorrect ? 'won' : 'lost',
            score: finalScore,
            score_raw: baseScore,
            attempts: nextAttempts,
            time_seconds: Math.floor((now.getTime() - new Date(session.start_time).getTime()) / 1000),
            is_ranked: isRanked,
            ranked_reason: rankedReason,
            scoring_version: 1
        });

        // Track Game Completion
        await trackEvent('game_completed', {
            session_id: sessionId,
            challenge_id: session.challenge_id,
            status: isCorrect ? 'won' : 'lost',
            score: finalScore,
            attempts: nextAttempts,
            time_seconds: Math.floor((now.getTime() - new Date(session.start_time).getTime()) / 1000)
        }, user.id);
    }

    // 6. Get Next Image URL
    const nextImageUrl = await getImageUrlForStep(sessionId);

    // 7. Return Result
    return {
        result: isCorrect ? 'correct' : 'incorrect',
        newNonce: newNonce,
        imageUrl: nextImageUrl,
        revealState: getRevealPercentages(nextAttempts),
        gameStatus: isCorrect ? 'won' : (nextAttempts >= 6 ? 'lost' : 'active'),
        finalScore: isGameOver ? finalScore : undefined,
    };
}
