import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Software Manager E2E tests
 * Following TDD Plan section 9: E2E Test Architecture
 */
export default defineConfig({
    // Test directory
    testDir: './e2e',

    // Global timeout for each test
    timeout: 60000, // 60 seconds

    // Run tests in files in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry on CI only
    retries: process.env.CI ? 2 : 0,

    // Opt out of parallel tests on CI
    workers: process.env.CI ? 1 : undefined,

    // Reporter to use
    reporter: 'html',
    // Shared settings for all the projects below
    use: {
        // Base URL to use in actions like `await page.goto('/')`
        // baseURL: 'http://127.0.0.1:3000',

        // Collect trace when retrying the failed test
        trace: 'on-first-retry',

        // Collect video when retrying the failed test
        video: 'retain-on-failure',

        // Collect screenshot when retrying the failed test
        screenshot: 'only-on-failure',

        // Increase timeouts for Electron apps
        actionTimeout: 10000,
        navigationTimeout: 30000,
    },
    // Configure projects for major browsers and Electron
    projects: [
        {
            name: 'electron',
            use: {
                ...devices['Desktop Chrome'],
                // Custom Electron launcher will be configured in tests
            },
        },
    ],

    // Run your local dev server before starting the tests
    // webServer: {
    //   command: 'npm run start',
    //   url: 'http://127.0.0.1:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
});
