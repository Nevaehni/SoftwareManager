import { PackageManagerDetector, PackageManagerInfo } from '../src/package-manager-detector';
import * as sinon from 'sinon';

// Mock child_process
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

// Mock util
jest.mock('util', () => ({
    promisify: jest.fn().mockReturnValue(jest.fn()),
}));

describe('PackageManagerDetector', () => {
    let detector: PackageManagerDetector;
    let mockExecAsync: jest.MockedFunction<any>;

    beforeEach(() => {
        detector = new PackageManagerDetector();

        // Get the mocked exec function
        const util = require('util');
        mockExecAsync = util.promisify();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('detectWinget', () => {
        test('PackageDetector_detectWinget_success', async () => {
            // Red phase: Test successful Winget detection
            mockExecAsync.mockResolvedValue({
                stdout: 'v1.6.2921',
                stderr: ''
            });

            const result = await detector.detectWinget();

            expect(result.name).toBe('Winget');
            expect(result.available).toBe(true);
            expect(result.version).toBe('1.6.2921');
        });

        test('PackageDetector_detectWinget_not_found', async () => {
            // Test Winget not available
            mockExecAsync.mockRejectedValue(new Error('winget command not found'));

            const result = await detector.detectWinget();

            expect(result.name).toBe('Winget');
            expect(result.available).toBe(false);
            expect(result.error).toContain('winget command not found');
        });
    });

    describe('detectChocolatey', () => {
        test('PackageDetector_detectChocolatey_success', async () => {
            // Test successful Chocolatey detection
            mockExecAsync.mockResolvedValue({
                stdout: '2.2.2',
                stderr: ''
            });

            const result = await detector.detectChocolatey();

            expect(result.name).toBe('Chocolatey');
            expect(result.available).toBe(true);
            expect(result.version).toBe('2.2.2');
        });

        test('PackageDetector_detectChocolatey_not_found', async () => {
            // Test Chocolatey not available
            mockExecAsync.mockRejectedValue(new Error('choco command not found'));

            const result = await detector.detectChocolatey();

            expect(result.name).toBe('Chocolatey');
            expect(result.available).toBe(false);
            expect(result.error).toContain('choco command not found');
        });
    });

    describe('detectAll', () => {
        test('PackageDetector_detectAll_both_available', async () => {
            // Test detection of all package managers
            mockExecAsync
                .mockResolvedValueOnce({ stdout: 'v1.6.2921', stderr: '' }) // Winget
                .mockResolvedValueOnce({ stdout: '2.2.2', stderr: '' });     // Chocolatey

            const results = await detector.detectAll();

            expect(results).toHaveLength(2);
            expect(results[0].name).toBe('Winget');
            expect(results[0].available).toBe(true);
            expect(results[1].name).toBe('Chocolatey');
            expect(results[1].available).toBe(true);
        });

        test('PackageDetector_detectAll_mixed_availability', async () => {
            // Test when only one package manager is available
            mockExecAsync
                .mockResolvedValueOnce({ stdout: 'v1.6.2921', stderr: '' }) // Winget available
                .mockRejectedValueOnce(new Error('choco not found'));       // Chocolatey not available

            const results = await detector.detectAll();

            expect(results).toHaveLength(2);
            expect(results[0].available).toBe(true);
            expect(results[1].available).toBe(false);
        });
    });

    describe('convenience methods', () => {
        test('PackageDetector_isWingetAvailable_returns_boolean', async () => {
            // Test convenience method for Winget availability
            mockExecAsync.mockResolvedValue({ stdout: 'v1.6.2921', stderr: '' });

            const isAvailable = await detector.isWingetAvailable();

            expect(typeof isAvailable).toBe('boolean');
            expect(isAvailable).toBe(true);
        });

        test('PackageDetector_isChocolateyAvailable_returns_boolean', async () => {
            // Test convenience method for Chocolatey availability
            mockExecAsync.mockRejectedValue(new Error('not found'));

            const isAvailable = await detector.isChocolateyAvailable();

            expect(typeof isAvailable).toBe('boolean');
            expect(isAvailable).toBe(false);
        });
    });

    describe('getRecommendations', () => {
        test('PackageDetector_getRecommendations_none_available', async () => {
            // Test recommendations when no package managers are available
            mockExecAsync.mockRejectedValue(new Error('not found'));

            const recommendations = await detector.getRecommendations();

            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.some(r => r.includes('Winget'))).toBe(true);
            expect(recommendations.some(r => r.includes('Chocolatey'))).toBe(true);
        });

        test('PackageDetector_getRecommendations_both_available', async () => {
            // Test recommendations when both package managers are available
            mockExecAsync
                .mockResolvedValueOnce({ stdout: 'v1.6.2921', stderr: '' })
                .mockResolvedValueOnce({ stdout: '2.2.2', stderr: '' });

            const recommendations = await detector.getRecommendations();

            expect(recommendations.some(r => r.includes('Both package managers are available'))).toBe(true);
        });
    });
});
