import { test, expect } from '@playwright/test';

test.describe('Game Completion Flows', () => {

    test('Victory Flow (Win)', async ({ page, request }) => {
        // 1. Fetch the correct answer from our dev-only API
        const response = await request.get('/api/test/daily-answer');

        if (!response.ok()) {
            console.log(`Skipping Win test: Could not fetch daily answer. Status: ${response.status()}`);
            try {
                const body = await response.json();
                console.log('API Error Body:', body);
            } catch (e) { console.log('Could not parse API error body'); }

            test.skip(true, 'Skipping due to missing daily answer (404/403).');
            return;
        }

        const answer = await response.json();
        console.log(`[TEST] Winning perfume is: ${answer.name} by ${answer.brand}`);

        // 2. Load Game
        await page.goto('/');

        if (await page.getByText(/Gra zakończona|Come back tomorrow/i).isVisible()) {
            test.skip(true, 'Game is closed.');
            return;
        }

        // 3. Input the correct answer
        const input = page.getByPlaceholder(/Guess the fragrance|Napisz jakie to perfumy/i);
        await input.fill(answer.name);

        // 4. Select from suggestions
        const suggestion = page.locator('button[class*="text-left text-sm"]').first();
        await expect(suggestion).toBeVisible({ timeout: 10000 });

        await suggestion.click({ force: true });

        // 5. Verify Win State
        await expect(page.getByText(/Gratulacje/i)).toBeVisible({ timeout: 10000 });

    });

    test('Defeat Flow (Loss)', async ({ page }) => {
        // Enable console logging from the browser to debug game state issues
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

        await page.goto('/');

        if (await page.getByText(/Gra zakończona|Come back tomorrow/i).isVisible()) {
            test.skip(true, 'Game is closed.');
            return;
        }

        const input = page.getByPlaceholder(/Guess the fragrance|Napisz jakie to perfumy/i);

        // Wait for game initialization
        await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });

        // Use distinct global brands to ensure we pick DIFFERENT perfumes every time
        // This avoids the "Duplicate Guess" prevention logic
        const queries = ['Chanel', 'Dior', 'Gucci', 'Versace', 'YSL', 'Armani'];

        for (let i = 0; i < 6; i++) {
            const query = queries[i];

            // Ensure input is empty before typing
            await input.fill('');
            await input.fill(query);

            // Wait for suggestions
            const suggestions = page.locator('button[class*="text-left text-sm"]');
            await expect(suggestions.first()).toBeVisible({ timeout: 5000 });

            // Click the FIRST suggestion for this distinct brand
            const suggestion = suggestions.first();
            await expect(suggestion).toBeVisible();
            const suggestionText = await suggestion.textContent();
            console.log(`[LOSS FLOW ${i + 1}] Clicking suggestion: "${suggestionText}" (Query: ${query})`);

            await suggestion.click({ force: true });

            // Wait for input to be cleared (signal that guess was processed)
            try {
                await expect(input).toHaveValue('', { timeout: 3000 });
            } catch (e) {
                console.log(`[WARN] Input not cleared on attempt ${i + 1} ("${query}"). Retrying click...`);
                // Retry click just in case
                await suggestions.first().click({ force: true });
                await expect(input).toHaveValue('', { timeout: 3000 });
            }

            // Wait a beat to ensure state update
            await page.waitForTimeout(500);
        }

        // 6. Verify Loss State
        // Text comes from messages/en.json ("The answer was...") or pl.json ("Odpowiedź to...")
        // 6. Verify Loss State
        // Check for the "Closed" message in the input area
        await expect(page.getByText(/Wróć jutro po kolejną zagadkę!/i)).toBeVisible({ timeout: 10000 });

        const showAnswerBtn = page.getByText(/Pokaż rozwiązanie|Show Answer/i);
        if (await showAnswerBtn.isVisible()) {
            await showAnswerBtn.click();
            await expect(page.locator('.text-brand-gold-500').first()).toBeVisible();
        }
    });

});
