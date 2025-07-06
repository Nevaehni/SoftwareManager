"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_contract_1 = require("./adapter-contract");
const winget_adapter_1 = require("../winget-adapter");
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
    (0, adapter_contract_1.shouldBehaveLikePackageAdapter)(() => new winget_adapter_1.WingetAdapter(mockExecFunction));
});
//# sourceMappingURL=winget-adapter.contract.spec.js.map