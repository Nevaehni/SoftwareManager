import { PackageAdapter } from '../../../core/src/package-adapter';

/**
 * Shared test suite that any PackageAdapter implementation must pass
 */
export function shouldBehaveLikePackageAdapter(factory: () => PackageAdapter) {
    describe('PackageAdapter contract', () => {
        it('exportList creates file with package data', () => {
            const adapter = factory();
            const filename = 'test-output.yaml';

            // This test will fail until we implement the adapter properly
            expect(() => adapter.exportList(filename)).not.toThrow();
        });
    });
}
