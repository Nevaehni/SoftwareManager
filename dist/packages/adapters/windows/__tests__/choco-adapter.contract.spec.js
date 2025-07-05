"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const choco_adapter_1 = require("../choco-adapter");
const adapter_contract_1 = require("./adapter-contract");
describe('ChocoAdapter Contract Tests', () => {
    let mockExec;
    beforeEach(() => {
        mockExec = jest.fn();
        // Setup default successful responses for contract tests
        mockExec.mockImplementation(async (command, args) => {
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
    (0, adapter_contract_1.shouldBehaveLikePackageAdapter)(() => new choco_adapter_1.ChocoAdapter(mockExec));
});
//# sourceMappingURL=choco-adapter.contract.spec.js.map