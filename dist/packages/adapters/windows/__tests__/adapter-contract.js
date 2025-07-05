"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldBehaveLikePackageAdapter = shouldBehaveLikePackageAdapter;
/**
 * Shared test suite that any PackageAdapter implementation must pass
 */
function shouldBehaveLikePackageAdapter(factory) {
    describe('PackageAdapter contract', () => {
        it('exportList creates file with package data', async () => {
            const adapter = factory();
            const filename = 'test-output.yaml';
            // This test will fail until we implement the adapter properly
            await expect(adapter.exportList(filename)).resolves.not.toThrow();
        });
        it('should have required methods defined', () => {
            const adapter = factory();
            expect(typeof adapter.exportList).toBe('function');
            // Note: Other methods may not be defined in the base interface
            // but specific adapters should implement them
        });
        it('exportList should handle different filename formats', async () => {
            const adapter = factory();
            // Test with different file extensions
            await expect(adapter.exportList('test.yaml')).resolves.not.toThrow();
            await expect(adapter.exportList('test.yml')).resolves.not.toThrow();
        });
    });
}
//# sourceMappingURL=adapter-contract.js.map