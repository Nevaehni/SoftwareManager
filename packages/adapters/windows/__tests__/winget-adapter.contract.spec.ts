import { PackageAdapter } from '../../../core/src/package-adapter';
import { shouldBehaveLikePackageAdapter } from './adapter-contract';
import { WingetAdapter } from '../winget-adapter';

describe('WingetAdapter', () => {
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

    shouldBehaveLikePackageAdapter(() => new WingetAdapter(mockExecFunction));
});
