"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// F-01: One-click package manager installer - Unit test
const package_manager_installer_1 = require("../src/package-manager-installer");
describe('Package Manager Installer', () => {
    let installer;
    beforeEach(() => {
        installer = new package_manager_installer_1.PackageManagerInstaller();
    });
    test('Installer_detectsMissingManagers', async () => {
        // Red phase: Test that installer detects missing package managers
        const missing = await installer.detectMissingManagers();
        expect(Array.isArray(missing)).toBe(true);
        // Should include managers that aren't installed
    });
    test('Installer_installsWinget', async () => {
        // Red phase: Test that installer can install Winget
        const result = await installer.installWinget();
        expect(result.success).toBe(true);
        expect(result.message).toContain('Winget installed successfully');
    });
    test('Installer_installsChocolatey', async () => {
        // Red phase: Test that installer can install Chocolatey  
        const result = await installer.installChocolatey();
        expect(result.success).toBe(true);
        expect(result.message).toContain('Chocolatey installed successfully');
    });
});
//# sourceMappingURL=bootstrap.spec.js.map