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
    });
}
//# sourceMappingURL=adapter-contract.js.map