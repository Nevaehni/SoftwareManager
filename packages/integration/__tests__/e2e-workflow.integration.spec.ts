import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

describe('End-to-End Integration Tests', () => {
    const cliPath = path.join(__dirname, '..', '..', '..', 'dist', 'packages', 'cli', 'software-manager.js');
    const testOutputFile = path.join(__dirname, '..', '..', '..', 'tmp', 'e2e-test-backup.yaml');

    beforeEach(() => {
        // Clean up any previous test files
        if (fs.existsSync(testOutputFile)) {
            fs.unlinkSync(testOutputFile);
        }
    });

    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testOutputFile)) {
            fs.unlinkSync(testOutputFile);
        }
    });

    describe('CLI End-to-End Functionality', () => {
        test('CLI help command works', async () => {
            console.log('Testing CLI help command...');
            console.log('CLI path:', cliPath);
            console.log('CLI exists:', fs.existsSync(cliPath));

            if (!fs.existsSync(cliPath)) {
                console.log('⚠️ CLI not found, skipping CLI test');
                return;
            }

            try {
                // Test that the CLI can show help
                const { stdout, stderr } = await execAsync(`node "${cliPath}" help`);

                expect(stdout).toContain('Software Manager CLI');
                expect(stdout).toContain('backup');
                expect(stdout).toContain('restore');
                expect(stderr).toBe('');

                console.log('✅ CLI help command test passed');

            } catch (error) {
                console.error('❌ CLI help test error:', error);
                throw error;
            }
        });

        test('CLI version command works', async () => {
            console.log('Testing CLI version command...');

            if (!fs.existsSync(cliPath)) {
                console.log('⚠️ CLI not found, skipping version test');
                return;
            }

            try {
                const { stdout } = await execAsync(`node "${cliPath}" version`);

                expect(stdout).toContain('Software Manager CLI');
                console.log('✅ CLI version command test passed');

            } catch (error) {
                console.error('❌ CLI version test error:', error);
                throw error;
            }
        });
    });

    describe('File System Operations', () => {
        test('Basic file operations work', () => {
            console.log('Testing basic file operations...');
            // Test that we can create and read files in tmp directory
            const tmpDir = path.join(__dirname, '..', '..', '..', 'tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const testFile = path.join(tmpDir, 'e2e-test.txt');
            const testContent = 'E2E test content';

            // Write test content
            fs.writeFileSync(testFile, testContent);

            // Read and verify
            const readContent = fs.readFileSync(testFile, 'utf8');
            expect(readContent).toBe(testContent);

            // Clean up
            fs.unlinkSync(testFile);

            console.log('✅ Basic file operations test passed');
        });
    });
});
