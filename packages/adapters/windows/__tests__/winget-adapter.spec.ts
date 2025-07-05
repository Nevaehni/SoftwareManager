import { WingetAdapter } from '../winget-adapter';
import * as sinon from 'sinon';

describe('WingetAdapter Unit Tests', () => {
    it('Winget_search_parses', async () => {
        // Red phase: Test that search() parses JSON output from winget search
        const mockJson = JSON.stringify([
            { "Id": "Git.Git", "Name": "Git", "Version": "2.42.0" },
            { "Id": "Microsoft.VisualStudioCode", "Name": "Visual Studio Code", "Version": "1.85.0" }
        ]);

        const execStub = sinon.stub().resolves({
            stdout: mockJson,
            stderr: '',
            exitCode: 0
        });

        const adapter = new WingetAdapter(execStub);
        const results = await adapter.search('git');

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('Id');
        expect(results[0]).toHaveProperty('Name');
        expect(results[0]).toHaveProperty('Version');
        expect(execStub.calledOnce).toBe(true);
        expect(execStub.calledWith('winget', ['search', 'git', '--accept-source-agreements'])).toBe(true);
    });
    it('Winget_install_version', async () => {
        // Red phase: Test that install(version) pins version in command
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });

        const adapter = new WingetAdapter(execStub);
        await adapter.install('Git.Git', '2.35.0');

        expect(execStub.calledOnce).toBe(true);
        expect(execStub.calledWith('winget', ['install', 'Git.Git', '--version', '2.35.0', '--accept-source-agreements'])).toBe(true);
    });
    it('Winget_ensure_absent', async () => {
        // Red phase: Test that ensurePresent() returns false when exit code ≠ 0
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: 'Package not found',
            exitCode: 1
        });

        const adapter = new WingetAdapter(execStub);
        const result = await adapter.ensurePresent('Git.Git');

        expect(result).toBe(false);
        expect(execStub.calledOnce).toBe(true);
    });
});
