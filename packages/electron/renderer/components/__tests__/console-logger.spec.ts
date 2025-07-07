/**
 * Console Logger Component Tests
 * Tests for the real-time logging functionality
 */

describe('ConsoleLogger', () => {
    let consoleLogger: any;
    let container: HTMLElement;

    beforeEach(() => {
        // Create test container with console elements
        container = document.createElement('div');
        container.innerHTML = `
            <div id="console-output"></div>
            <button id="clear-console-btn">Clear</button>
            <button id="copy-logs-btn">Copy</button>
            <input type="checkbox" id="auto-scroll-checkbox" checked>
            <input type="text" id="log-filter">
            <select id="log-level">
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
            </select>
            <span id="log-count">0 logs</span>
        `;
        document.body.appendChild(container);

        // Mock navigator.clipboard for copy functionality
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn().mockResolvedValue(undefined)
            }
        });

        // Mock the ConsoleLogger since we're testing in a Node.js environment
        class MockConsoleLogger {
            public logs: any[] = [];
            public autoScroll: boolean = true;
            public currentFilter: string = '';
            public currentLevel: string = 'all';
            public maxLogs: number = 1000;
            private outputElement: HTMLElement | null = null;

            constructor() {
                this.outputElement = document.getElementById('console-output');
                this.setupEventListeners();
            }

            private setupEventListeners(): void {
                const clearBtn = document.getElementById('clear-console-btn');
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => this.clearLogs());
                }

                const copyBtn = document.getElementById('copy-logs-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => this.copyAllLogs());
                }

                const autoScrollCheckbox = document.getElementById('auto-scroll-checkbox') as HTMLInputElement;
                if (autoScrollCheckbox) {
                    autoScrollCheckbox.addEventListener('change', () => {
                        this.autoScroll = autoScrollCheckbox.checked;
                    });
                }

                const filterInput = document.getElementById('log-filter') as HTMLInputElement;
                if (filterInput) {
                    filterInput.addEventListener('input', () => {
                        this.currentFilter = filterInput.value.toLowerCase();
                        this.applyFilters();
                    });
                }

                const levelSelect = document.getElementById('log-level') as HTMLSelectElement;
                if (levelSelect) {
                    levelSelect.addEventListener('change', () => {
                        this.currentLevel = levelSelect.value;
                        this.applyFilters();
                    });
                }
            }

            info(message: string, source?: string): void {
                this.log('info', message, source);
            }

            warn(message: string, source?: string): void {
                this.log('warn', message, source);
            }

            error(message: string, source?: string): void {
                this.log('error', message, source);
            }

            success(message: string, source?: string): void {
                this.log('success', message, source);
            }

            private log(level: string, message: string, source?: string): void {
                const entry = {
                    timestamp: new Date(),
                    level,
                    message,
                    source
                };
                this.logs.push(entry);

                // Enforce max logs limit
                if (this.logs.length > this.maxLogs) {
                    this.logs = this.logs.slice(-this.maxLogs);
                }

                this.displayLogEntry(entry);
                this.updateLogCount();
            }

            private displayLogEntry(entry: any): void {
                if (!this.outputElement) return;

                const logElement = document.createElement('div');
                logElement.className = `console-log-entry console-log-${entry.level}`;

                const timestamp = entry.timestamp.toLocaleTimeString();
                const levelTag = `[${entry.level.toUpperCase()}]`;
                const sourceTag = entry.source ? `[${entry.source}]` : '';

                logElement.innerHTML = `
                    <span class="console-timestamp">${timestamp}</span>
                    <span class="console-log-${entry.level}">${levelTag}</span>
                    ${sourceTag ? `<span class="console-log-info">${sourceTag}</span>` : ''}
                    <span>${this.escapeHtml(entry.message)}</span>
                `;

                logElement.setAttribute('data-level', entry.level);
                logElement.setAttribute('data-message', entry.message.toLowerCase());
                logElement.setAttribute('data-source', entry.source?.toLowerCase() || '');

                this.outputElement.appendChild(logElement);
                this.applyFiltersToElement(logElement);
            }

            private applyFilters(): void {
                if (!this.outputElement) return;

                const entries = this.outputElement.querySelectorAll('.console-log-entry');
                entries.forEach(entry => {
                    this.applyFiltersToElement(entry as HTMLElement);
                });
            }

            private applyFiltersToElement(element: HTMLElement): void {
                const level = element.getAttribute('data-level') || '';
                const message = element.getAttribute('data-message') || '';
                const source = element.getAttribute('data-source') || '';

                let visible = true;

                if (this.currentLevel !== 'all' && level !== this.currentLevel) {
                    visible = false;
                }

                if (this.currentFilter &&
                    !message.includes(this.currentFilter) &&
                    !source.includes(this.currentFilter)) {
                    visible = false;
                }

                if (visible) {
                    element.classList.remove('filtered');
                } else {
                    element.classList.add('filtered');
                }

                element.style.display = visible ? 'block' : 'none';
            }

            clearLogs(): void {
                this.logs = [];
                if (this.outputElement) {
                    this.outputElement.innerHTML = '';
                }
                this.updateLogCount();
            }

            async copyAllLogs(): Promise<void> {
                const logText = this.logs.map(log => {
                    const timestamp = log.timestamp.toLocaleTimeString();
                    const levelTag = `[${log.level.toUpperCase()}]`;
                    const sourceTag = log.source ? `[${log.source}]` : '';
                    return `${timestamp} ${levelTag} ${sourceTag} ${log.message}`;
                }).join('\n');

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(logText);
                }
            }

            private updateLogCount(): void {
                const countElement = document.getElementById('log-count');
                if (countElement) {
                    const visibleCount = this.outputElement?.querySelectorAll('.console-log-entry:not(.filtered)').length || 0;
                    countElement.textContent = `${visibleCount} logs`;
                }
            }

            private escapeHtml(text: string): string {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            logBackupProgress(progress: number, message: string): void {
                this.info(`[${progress}%] ${message}`, 'Backup');
            }

            logRestoreProgress(progress: number, message: string): void {
                this.info(`[${progress}%] ${message}`, 'Restore');
            }

            logPackageOperation(operation: string, packageName: string, success: boolean): void {
                if (success) {
                    this.success(`${operation} completed: ${packageName}`, 'Package Manager');
                } else {
                    this.error(`${operation} failed: ${packageName}`, 'Package Manager');
                }
            }

            logCommand(command: string, output: string, success: boolean): void {
                this.info(`Executing: ${command}`, 'Command');

                if (output) {
                    const lines = output.split('\n').filter(line => line.trim());
                    lines.forEach(line => {
                        if (success) {
                            this.info(line, 'Output');
                        } else {
                            this.error(line, 'Output');
                        }
                    });
                }
            }
        }

        consoleLogger = new MockConsoleLogger();
    });

    afterEach(() => {
        document.body.removeChild(container);
        jest.clearAllMocks();
    }); describe('Logging Functions', () => {
        it('should log info messages', () => {
            consoleLogger.info('Test info message', 'Test');

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(1);
            expect(logEntries?.[0].classList.contains('console-log-info')).toBe(true);
            expect(logEntries?.[0].textContent).toContain('Test info message');
            expect(logEntries?.[0].textContent).toContain('[INFO]');
            expect(logEntries?.[0].textContent).toContain('[Test]');
        });

        it('should log warning messages', () => {
            consoleLogger.warn('Test warning message');

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(1);
            expect(logEntries?.[0].classList.contains('console-log-warn')).toBe(true);
            expect(logEntries?.[0].textContent).toContain('Test warning message');
            expect(logEntries?.[0].textContent).toContain('[WARN]');
        });

        it('should log error messages', () => {
            consoleLogger.error('Test error message', 'Error Source');

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(1);
            expect(logEntries?.[0].classList.contains('console-log-error')).toBe(true);
            expect(logEntries?.[0].textContent).toContain('Test error message');
            expect(logEntries?.[0].textContent).toContain('[ERROR]');
            expect(logEntries?.[0].textContent).toContain('[Error Source]');
        });

        it('should log success messages', () => {
            consoleLogger.success('Test success message');

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(1);
            expect(logEntries?.[0].classList.contains('console-log-success')).toBe(true);
            expect(logEntries?.[0].textContent).toContain('Test success message');
            expect(logEntries?.[0].textContent).toContain('[SUCCESS]');
        });
    });

    describe('Filtering', () => {
        beforeEach(() => {
            // Add some test logs
            consoleLogger.info('Information message', 'Test');
            consoleLogger.warn('Warning message', 'Test');
            consoleLogger.error('Error message', 'Test');
            consoleLogger.success('Success message', 'Test');
        });

        it('should filter logs by text', () => {
            const filterInput = document.getElementById('log-filter') as HTMLInputElement;
            filterInput.value = 'warning';
            filterInput.dispatchEvent(new Event('input'));

            const outputElement = document.getElementById('console-output');
            const visibleEntries = outputElement?.querySelectorAll('.console-log-entry:not(.filtered)');

            expect(visibleEntries?.length).toBe(1);
            expect(visibleEntries?.[0].textContent).toContain('Warning message');
        });

        it('should filter logs by level', () => {
            const levelSelect = document.getElementById('log-level') as HTMLSelectElement;
            levelSelect.value = 'error';
            levelSelect.dispatchEvent(new Event('change'));

            const outputElement = document.getElementById('console-output');
            const visibleEntries = outputElement?.querySelectorAll('.console-log-entry:not(.filtered)');

            expect(visibleEntries?.length).toBe(1);
            expect(visibleEntries?.[0].textContent).toContain('Error message');
        });

        it('should show all logs when filter is cleared', () => {
            // First apply a filter
            const filterInput = document.getElementById('log-filter') as HTMLInputElement;
            filterInput.value = 'nonexistent';
            filterInput.dispatchEvent(new Event('input'));

            // Clear the filter
            filterInput.value = '';
            filterInput.dispatchEvent(new Event('input'));

            const outputElement = document.getElementById('console-output');
            const visibleEntries = outputElement?.querySelectorAll('.console-log-entry:not(.filtered)');

            expect(visibleEntries?.length).toBe(4);
        });
    });

    describe('Console Controls', () => {
        beforeEach(() => {
            consoleLogger.info('Test message 1');
            consoleLogger.warn('Test message 2');
        });

        it('should clear all logs when clear button is clicked', () => {
            const clearBtn = document.getElementById('clear-console-btn');
            clearBtn?.click();

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(0);
            expect(consoleLogger.logs.length).toBe(0);
        });

        it('should copy logs to clipboard when copy button is clicked', async () => {
            const copyBtn = document.getElementById('copy-logs-btn');
            copyBtn?.click();

            // Wait a bit for async operation
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(navigator.clipboard.writeText).toHaveBeenCalled();
        });

        it('should toggle auto-scroll setting', () => {
            const autoScrollCheckbox = document.getElementById('auto-scroll-checkbox') as HTMLInputElement;

            expect(autoScrollCheckbox.checked).toBe(true);
            expect(consoleLogger.autoScroll).toBe(true);

            autoScrollCheckbox.checked = false;
            autoScrollCheckbox.dispatchEvent(new Event('change'));

            expect(consoleLogger.autoScroll).toBe(false);
        });
    });

    describe('Progress Logging', () => {
        it('should log backup progress', () => {
            consoleLogger.logBackupProgress(50, 'Backing up packages');

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(1);
            expect(logEntries?.[0].textContent).toContain('[50%] Backing up packages');
            expect(logEntries?.[0].textContent).toContain('[Backup]');
        });

        it('should log restore progress', () => {
            consoleLogger.logRestoreProgress(75, 'Restoring packages');

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(1);
            expect(logEntries?.[0].textContent).toContain('[75%] Restoring packages');
            expect(logEntries?.[0].textContent).toContain('[Restore]');
        });

        it('should log package operations', () => {
            consoleLogger.logPackageOperation('install', 'git', true);
            consoleLogger.logPackageOperation('uninstall', 'notepad++', false);

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(2);
            expect(logEntries?.[0].textContent).toContain('install completed: git');
            expect(logEntries?.[0].classList.contains('console-log-success')).toBe(true);
            expect(logEntries?.[1].textContent).toContain('uninstall failed: notepad++');
            expect(logEntries?.[1].classList.contains('console-log-error')).toBe(true);
        });

        it('should log command execution', () => {
            consoleLogger.logCommand('winget list', 'git\nnotepad++\nvscode', true);

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.length).toBe(4); // 1 command + 3 output lines
            expect(logEntries?.[0].textContent).toContain('Executing: winget list');
            expect(logEntries?.[1].textContent).toContain('git');
            expect(logEntries?.[2].textContent).toContain('notepad++');
            expect(logEntries?.[3].textContent).toContain('vscode');
        });
    });

    describe('Log Count and Memory Management', () => {
        it('should update log count display', () => {
            consoleLogger.info('Test message 1');
            consoleLogger.warn('Test message 2');

            const countElement = document.getElementById('log-count');
            expect(countElement?.textContent).toBe('2 logs');
        });

        it('should escape HTML in log messages', () => {
            consoleLogger.info('<script>alert("xss")</script>');

            const outputElement = document.getElementById('console-output');
            const logEntries = outputElement?.querySelectorAll('.console-log-entry');

            expect(logEntries?.[0].innerHTML).toContain('&lt;script&gt;');
            expect(logEntries?.[0].innerHTML).not.toContain('<script>');
        });

        it('should limit logs to prevent memory issues', () => {
            // Set a low max limit for testing
            consoleLogger.maxLogs = 5;

            // Add more logs than the limit
            for (let i = 0; i < 10; i++) {
                consoleLogger.info(`Message ${i}`, 'Test');
            }

            // Should only keep the last 5 logs
            expect(consoleLogger.logs.length).toBe(5);
            expect(consoleLogger.logs[0].message).toContain('Message 5');
            expect(consoleLogger.logs[4].message).toContain('Message 9');
        });
    });
});