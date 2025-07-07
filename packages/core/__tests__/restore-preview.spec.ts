import { RestoreService } from '../src/restore-service';
import { WingetAdapter } from '../../adapters/windows/winget-adapter';
import * as fs from 'fs';
import * as sinon from 'sinon';

describe('RestoreService Preview Tests', () => {
    beforeEach(() => {
        // Ensure tmp directory exists
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up tmp directory after tests  
        if (fs.existsSync('tmp')) {
            fs.rmSync('tmp', { recursive: true, force: true });
        }
    }); it('PreviewRestore_identifiesNewInstalls', async () => {
        // Test that packages not currently installed are identified as new installs
        const bundleContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.42.0
  - id: Microsoft.VisualStudioCode
    name: Visual Studio Code
    version: 1.85.0`;

        // Create test bundle file with unique name
        const testFile = 'tmp/test-bundle-preview-new-installs.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        // Mock adapter with no installed packages
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().resolves([]); const restoreService = new RestoreService(wingetAdapter);
        const preview = await restoreService.previewRestore(testFile);

        expect(preview.totalPackages).toBe(2);
        expect(preview.newInstalls.length).toBe(2);
        expect(preview.upgrades.length).toBe(0);
        expect(preview.downgrades.length).toBe(0);
        expect(preview.reinstalls.length).toBe(0);

        expect(preview.newInstalls[0].id).toBe('Git.Git');
        expect(preview.newInstalls[0].action).toBe('install');
        expect(preview.newInstalls[1].id).toBe('Microsoft.VisualStudioCode');
        expect(preview.newInstalls[1].action).toBe('install');

        expect(preview.summary.willInstall).toBe(2);
        expect(preview.summary.willUpgrade).toBe(0);
        expect(preview.summary.willDowngrade).toBe(0);
        expect(preview.summary.willReinstall).toBe(0);

        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }); it('PreviewRestore_identifiesUpgrades', async () => {
        // Test that newer versions in bundle are identified as upgrades
        const bundleContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.45.0
  - id: Microsoft.VisualStudioCode
    name: Visual Studio Code
    version: 1.90.0`;

        const testFile = 'tmp/test-bundle-preview-upgrades.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        // Mock adapter with older installed packages
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const installedPackages = [
            { id: 'Git.Git', name: 'Git', version: '2.42.0', source: 'winget' },
            { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.85.0', source: 'winget' }
        ]; const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().resolves(installedPackages);

        const restoreService = new RestoreService(wingetAdapter);
        const preview = await restoreService.previewRestore(testFile);

        expect(preview.totalPackages).toBe(2);
        expect(preview.newInstalls.length).toBe(0);
        expect(preview.upgrades.length).toBe(2);
        expect(preview.downgrades.length).toBe(0);
        expect(preview.reinstalls.length).toBe(0);

        expect(preview.upgrades[0].id).toBe('Git.Git');
        expect(preview.upgrades[0].action).toBe('upgrade');
        expect(preview.upgrades[0].installedVersion).toBe('2.42.0');
        expect(preview.upgrades[0].bundleVersion).toBe('2.45.0');

        expect(preview.upgrades[1].id).toBe('Microsoft.VisualStudioCode');
        expect(preview.upgrades[1].action).toBe('upgrade');
        expect(preview.upgrades[1].installedVersion).toBe('1.85.0');
        expect(preview.upgrades[1].bundleVersion).toBe('1.90.0');

        expect(preview.summary.willUpgrade).toBe(2);

        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }); it('PreviewRestore_identifiesDowngrades', async () => {
        // Test that older versions in bundle are identified as downgrades
        const bundleContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.40.0
  - id: Microsoft.VisualStudioCode
    name: Visual Studio Code
    version: 1.80.0`;

        const testFile = 'tmp/test-bundle-preview-downgrades.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        // Mock adapter with newer installed packages
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const installedPackages = [
            { id: 'Git.Git', name: 'Git', version: '2.42.0', source: 'winget' },
            { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.85.0', source: 'winget' }
        ];

        const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().resolves(installedPackages); const restoreService = new RestoreService(wingetAdapter);
        const preview = await restoreService.previewRestore(testFile);

        expect(preview.totalPackages).toBe(2);
        expect(preview.newInstalls.length).toBe(0);
        expect(preview.upgrades.length).toBe(0);
        expect(preview.downgrades.length).toBe(2);
        expect(preview.reinstalls.length).toBe(0);

        expect(preview.downgrades[0].id).toBe('Git.Git');
        expect(preview.downgrades[0].action).toBe('downgrade');
        expect(preview.downgrades[0].installedVersion).toBe('2.42.0');
        expect(preview.downgrades[0].bundleVersion).toBe('2.40.0');

        expect(preview.summary.willDowngrade).toBe(2);

        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }); it('PreviewRestore_identifiesReinstalls', async () => {
        // Test that same versions are identified as reinstalls
        const bundleContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.42.0
  - id: Microsoft.VisualStudioCode
    name: Visual Studio Code
    version: 1.85.0`;

        const testFile = 'tmp/test-bundle-preview-reinstalls.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        // Mock adapter with same versions installed
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const installedPackages = [
            { id: 'Git.Git', name: 'Git', version: '2.42.0', source: 'winget' },
            { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.85.0', source: 'winget' }
        ];

        const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().resolves(installedPackages); const restoreService = new RestoreService(wingetAdapter);
        const preview = await restoreService.previewRestore(testFile);

        expect(preview.totalPackages).toBe(2);
        expect(preview.newInstalls.length).toBe(0);
        expect(preview.upgrades.length).toBe(0);
        expect(preview.downgrades.length).toBe(0);
        expect(preview.reinstalls.length).toBe(2);

        expect(preview.reinstalls[0].id).toBe('Git.Git');
        expect(preview.reinstalls[0].action).toBe('reinstall');
        expect(preview.reinstalls[0].installedVersion).toBe('2.42.0');
        expect(preview.reinstalls[0].bundleVersion).toBe('2.42.0');

        expect(preview.summary.willReinstall).toBe(2);

        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }); it('PreviewRestore_mixedScenario', async () => {
        // Test a complex scenario with various types of changes
        const bundleContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.45.0
  - id: Microsoft.VisualStudioCode
    name: Visual Studio Code
    version: 1.85.0
  - id: Discord.Discord
    name: Discord
    version: 1.0.9196
  - id: Notepad++.Notepad++
    name: Notepad++
    version: 8.5.0`;

        const testFile = 'tmp/test-bundle-preview-mixed.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        // Mock adapter with mixed installed packages
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const installedPackages = [
            { id: 'Git.Git', name: 'Git', version: '2.42.0', source: 'winget' }, // Will upgrade
            { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.85.0', source: 'winget' }, // Same version (reinstall)
            { id: 'Notepad++.Notepad++', name: 'Notepad++', version: '8.6.0', source: 'winget' } // Will downgrade
            // Discord not installed - will be new install
        ];

        const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().resolves(installedPackages); const restoreService = new RestoreService(wingetAdapter);
        const preview = await restoreService.previewRestore(testFile);

        expect(preview.totalPackages).toBe(4);
        expect(preview.newInstalls.length).toBe(1);
        expect(preview.upgrades.length).toBe(1);
        expect(preview.downgrades.length).toBe(1);
        expect(preview.reinstalls.length).toBe(1);

        // Check new install
        expect(preview.newInstalls[0].id).toBe('Discord.Discord');
        expect(preview.newInstalls[0].action).toBe('install');

        // Check upgrade
        expect(preview.upgrades[0].id).toBe('Git.Git');
        expect(preview.upgrades[0].action).toBe('upgrade');
        expect(preview.upgrades[0].installedVersion).toBe('2.42.0');
        expect(preview.upgrades[0].bundleVersion).toBe('2.45.0');

        // Check downgrade
        expect(preview.downgrades[0].id).toBe('Notepad++.Notepad++');
        expect(preview.downgrades[0].action).toBe('downgrade');
        expect(preview.downgrades[0].installedVersion).toBe('8.6.0');
        expect(preview.downgrades[0].bundleVersion).toBe('8.5.0');

        // Check reinstall
        expect(preview.reinstalls[0].id).toBe('Microsoft.VisualStudioCode');
        expect(preview.reinstalls[0].action).toBe('reinstall');
        expect(preview.reinstalls[0].installedVersion).toBe('1.85.0');
        expect(preview.reinstalls[0].bundleVersion).toBe('1.85.0');

        // Check summary
        expect(preview.summary.willInstall).toBe(1);
        expect(preview.summary.willUpgrade).toBe(1);
        expect(preview.summary.willDowngrade).toBe(1);
        expect(preview.summary.willReinstall).toBe(1);
        expect(preview.summary.willSkip).toBe(0);

        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }); it('PreviewRestore_handlesEmptyBundle', async () => {
        // Test handling of empty bundle
        const bundleContent = 'packages: []';

        const testFile = 'tmp/test-bundle-preview-empty.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().resolves([]); const restoreService = new RestoreService(wingetAdapter);
        const preview = await restoreService.previewRestore(testFile);

        expect(preview.totalPackages).toBe(0);
        expect(preview.newInstalls.length).toBe(0);
        expect(preview.upgrades.length).toBe(0);
        expect(preview.downgrades.length).toBe(0);
        expect(preview.reinstalls.length).toBe(0);
        expect(preview.skipped.length).toBe(0);

        expect(preview.summary.willInstall).toBe(0);
        expect(preview.summary.willUpgrade).toBe(0);
        expect(preview.summary.willDowngrade).toBe(0);
        expect(preview.summary.willReinstall).toBe(0);
        expect(preview.summary.willSkip).toBe(0);

        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }); it('PreviewRestore_handlesListInstalledError', async () => {
        // Test that preview gracefully handles errors when listing installed packages
        const bundleContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.42.0`;

        const testFile = 'tmp/test-bundle-preview-error.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().rejects(new Error('Failed to list packages')); const restoreService = new RestoreService(wingetAdapter);
        const preview = await restoreService.previewRestore(testFile);

        // Should treat all packages as new installs when listing fails
        expect(preview.totalPackages).toBe(1);
        expect(preview.newInstalls.length).toBe(1);
        expect(preview.newInstalls[0].id).toBe('Git.Git');
        expect(preview.newInstalls[0].action).toBe('install');
        expect(preview.summary.willInstall).toBe(1);

        // Clean up test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    }); it('PreviewRestore_reportsProgress', async () => {
        // Test that preview reports progress through callback
        const bundleContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.42.0`;

        const testFile = 'tmp/test-bundle-preview-progress.yaml';
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync(testFile, bundleContent);

        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const wingetAdapter = new WingetAdapter(execStub);
        wingetAdapter.listInstalled = sinon.stub().resolves([]);

        const restoreService = new RestoreService(wingetAdapter);

        const progressCallback = sinon.spy();
        restoreService.setProgressCallback(progressCallback);

        await restoreService.previewRestore(testFile);

        // Verify progress callback was called
        expect(progressCallback.callCount).toBeGreaterThan(0);

        // Check specific progress messages
        const calls = progressCallback.getCalls();
        expect(calls.some(call => call.args[1].includes('Reading bundle file'))).toBe(true);
        expect(calls.some(call => call.args[1].includes('Getting currently installed packages'))).toBe(true);
        expect(calls.some(call => call.args[1].includes('Analyzing package differences'))).toBe(true);
        expect(calls.some(call => call.args[1].includes('Preview analysis complete'))).toBe(true);

        // Clean up the test file
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    });
});
