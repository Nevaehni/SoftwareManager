"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_contract_1 = require("./adapter-contract");
const winget_adapter_1 = require("../winget-adapter");
describe('WingetAdapter', () => {
    (0, adapter_contract_1.shouldBehaveLikePackageAdapter)(() => new winget_adapter_1.WingetAdapter());
});
//# sourceMappingURL=winget-adapter.contract.spec.js.map