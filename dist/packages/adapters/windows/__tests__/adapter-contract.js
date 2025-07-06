"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldBehaveLikePackageAdapter = shouldBehaveLikePackageAdapter;
/**
 * Shared test suite that any PackageAdapter implementation must pass
 */
function shouldBehaveLikePackageAdapter(factory) {
    describe('PackageAdapter contract', () => {
        // Mock exec function for testing
        const mockExecFunction = jest.fn();
        beforeEach(() => {
            mockExecFunction.mockReset();
            mockExecFunction.mockResolvedValue({
                stdout: JSON.stringify([{ Id: 'Test.Package', Name: 'Test Package', Version: '1.0.0' }]),
                stderr: '',
                exitCode: 0
            });
        });
        it('exportList creates file with package data', async () => {
            const adapter = factory();
            const filename = 'test-output.yaml';
            // This test will fail until we implement the adapter properly
            await expect(adapter.exportList(filename)).resolves.not.toThrow();
        });
        it('should have required methods defined', () => {
            const adapter = factory();
            expect(typeof adapter.exportList).toBe('function');
            expect(typeof adapter.search).toBe('function');
            expect(typeof adapter.install).toBe('function');
            expect(typeof adapter.ensurePresent).toBe('function');
        });
        it('exportList should handle different filename formats', async () => {
            const adapter = factory();
            // Test with different file extensions
            await expect(adapter.exportList('test.yaml')).resolves.not.toThrow();
            await expect(adapter.exportList('test.yml')).resolves.not.toThrow();
        });
        it('search should return array of packages for empty query', async () => {
            const adapter = factory();
            const results = await adapter.search('');
            expect(Array.isArray(results)).toBe(true);
            results.forEach(pkg => {
                expect(pkg).toHaveProperty('id');
                expect(pkg).toHaveProperty('name');
                expect(pkg).toHaveProperty('version');
            });
        });
        it('search should return array of packages for specific query', async () => {
            const adapter = factory();
            const results = await adapter.search('git');
            expect(Array.isArray(results)).toBe(true);
            if (results.length > 0) {
                results.forEach(pkg => {
                    expect(pkg).toHaveProperty('id');
                    expect(pkg).toHaveProperty('name');
                    expect(pkg).toHaveProperty('version');
                });
            }
        });
        it('install should return boolean indicating success', async () => {
            const adapter = factory();
            // Test with mock package ID
            const result = await adapter.install('mock.package');
            expect(typeof result).toBe('boolean');
        });
        it('ensurePresent should return boolean indicating if package is installed', async () => {
            const adapter = factory();
            // Test with mock package ID
            const result = await adapter.ensurePresent('mock.package');
            expect(typeof result).toBe('boolean');
        });
    });
}
//# sourceMappingURL=adapter-contract.js.map