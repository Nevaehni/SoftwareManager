import { ChocoAdapter } from '../choco-adapter';
import { shouldBehaveLikePackageAdapter } from './adapter-contract';

// Mock exec function type
interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
type ExecFunction = (command: string, args: string[]) => Promise<ExecResult>;

describe('ChocoAdapter', () => {
    // Mock exec function for testing
    const mockExecFunction = jest.fn();

    beforeEach(() => {
        mockExecFunction.mockReset();
        mockExecFunction.mockResolvedValue({
            stdout: 'test-package|1.0.0\n',
            stderr: '',
            exitCode: 0
        });
    });

    shouldBehaveLikePackageAdapter(() => new ChocoAdapter(mockExecFunction));
});

describe('ChocoAdapter Contract Tests', () => {
    let mockExec: jest.MockedFunction<ExecFunction>;

    beforeEach(() => {
        mockExec = jest.fn();

        // Setup default successful responses for contract tests
        mockExec.mockImplementation(async (command: string, args: string[]) => {
            if (args.includes('list') && args.includes('--local-only')) {
                return {
                    stdout: 'chocolatey|2.2.2\nnodejs|20.10.0',
                    stderr: '',
                    exitCode: 0,
                };
            }

            if (args.includes('search')) {
                return {
                    stdout: 'nodejs|20.10.0\ngit|2.42.0',
                    stderr: '',
                    exitCode: 0,
                };
            }

            if (args.includes('install')) {
                return {
                    stdout: 'Package installed successfully',
                    stderr: '',
                    exitCode: 0,
                };
            }

            return {
                stdout: '',
                stderr: '',
                exitCode: 0,
            };
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Run the shared contract tests
    shouldBehaveLikePackageAdapter(() => new ChocoAdapter(mockExec));
});
