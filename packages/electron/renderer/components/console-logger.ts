/**
 * Console Logger Component
 * Handles real-time logging and display for the Software Manager console
 */

export interface LogEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    source?: string;
}

export class ConsoleLogger {
    private logs: LogEntry[] = [];
    private autoScroll: boolean = true;
    private currentFilter: string = '';
    private currentLevel: string = 'all';
    private outputElement: HTMLElement | null = null;
    private maxLogs: number = 1000; // Limit to prevent memory issues

    constructor() {
        this.initializeElements();
        this.setupEventListeners();
    }

    private initializeElements(): void {
        this.outputElement = document.getElementById('console-output');
    }

    private setupEventListeners(): void {
        // Clear button
        const clearBtn = document.getElementById('clear-console-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearLogs());
        }

        // Copy button
        const copyBtn = document.getElementById('copy-logs-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyAllLogs());
        }

        // Auto-scroll checkbox
        const autoScrollCheckbox = document.getElementById('auto-scroll-checkbox') as HTMLInputElement;
        if (autoScrollCheckbox) {
            autoScrollCheckbox.addEventListener('change', () => {
                this.autoScroll = autoScrollCheckbox.checked;
            });
        }

        // Filter input
        const filterInput = document.getElementById('log-filter') as HTMLInputElement;
        if (filterInput) {
            filterInput.addEventListener('input', () => {
                this.currentFilter = filterInput.value.toLowerCase();
                this.applyFilters();
            });
        }

        // Level select
        const levelSelect = document.getElementById('log-level') as HTMLSelectElement;
        if (levelSelect) {
            levelSelect.addEventListener('change', () => {
                this.currentLevel = levelSelect.value;
                this.applyFilters();
            });
        }
    }

    public log(level: 'info' | 'warn' | 'error' | 'success', message: string, source?: string): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            source
        };

        this.logs.push(entry);

        // Trim logs if we exceed max limit
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        this.displayLogEntry(entry);
        this.updateLogCount();

        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    public info(message: string, source?: string): void {
        this.log('info', message, source);
    }

    public warn(message: string, source?: string): void {
        this.log('warn', message, source);
    }

    public error(message: string, source?: string): void {
        this.log('error', message, source);
    }

    public success(message: string, source?: string): void {
        this.log('success', message, source);
    }

    private displayLogEntry(entry: LogEntry): void {
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

        // Set data attributes for filtering
        logElement.setAttribute('data-level', entry.level);
        logElement.setAttribute('data-message', entry.message.toLowerCase());
        logElement.setAttribute('data-source', entry.source?.toLowerCase() || '');

        this.outputElement.appendChild(logElement);

        // Apply current filters to new entry
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

        // Level filter
        const levelMatch = this.currentLevel === 'all' || level === this.currentLevel;

        // Text filter
        const textMatch = !this.currentFilter ||
            message.includes(this.currentFilter) ||
            source.includes(this.currentFilter);

        if (levelMatch && textMatch) {
            element.classList.remove('filtered');
        } else {
            element.classList.add('filtered');
        }
    }

    public clearLogs(): void {
        this.logs = [];
        if (this.outputElement) {
            this.outputElement.innerHTML = `
                <div class="text-gray-500">
                    <span class="text-blue-400">[INFO]</span> 
                    <span class="text-gray-400">Console cleared</span>
                    <br>
                    <span class="text-blue-400">[INFO]</span> 
                    <span class="text-gray-400">Ready for new logs...</span>
                </div>
            `;
        }
        this.updateLogCount();
    }

    private copyAllLogs(): void {
        const visibleLogs = this.logs.filter((_, index) => {
            const element = this.outputElement?.children[index] as HTMLElement;
            return element && !element.classList.contains('filtered');
        });

        const logText = visibleLogs.map(entry => {
            const timestamp = entry.timestamp.toLocaleTimeString();
            const levelTag = `[${entry.level.toUpperCase()}]`;
            const sourceTag = entry.source ? `[${entry.source}]` : '';
            return `${timestamp} ${levelTag} ${sourceTag} ${entry.message}`;
        }).join('\n');

        if (navigator.clipboard) {
            navigator.clipboard.writeText(logText).then(() => {
                this.info('Logs copied to clipboard', 'Console');
            }).catch(() => {
                this.error('Failed to copy logs to clipboard', 'Console');
            });
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = logText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.info('Logs copied to clipboard (legacy method)', 'Console');
        }
    }

    private scrollToBottom(): void {
        if (this.outputElement) {
            this.outputElement.scrollTop = this.outputElement.scrollHeight;
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

    // Public methods for external logging
    public logBackupProgress(progress: number, message: string): void {
        this.info(`[${progress}%] ${message}`, 'Backup');
    }

    public logRestoreProgress(progress: number, message: string): void {
        this.info(`[${progress}%] ${message}`, 'Restore');
    }

    public logPackageOperation(operation: string, packageName: string, success: boolean): void {
        if (success) {
            this.success(`${operation} completed: ${packageName}`, 'Package Manager');
        } else {
            this.error(`${operation} failed: ${packageName}`, 'Package Manager');
        }
    }

    public logCommand(command: string, output: string, success: boolean): void {
        this.info(`Executing: ${command}`, 'Command');

        if (output) {
            // Split output into lines and log each one
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
