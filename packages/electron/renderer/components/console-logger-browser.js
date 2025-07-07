/**
 * Console Logger Component - Browser Compatible Version
 * Handles real-time logging and display for the Software Manager console
 */

class ConsoleLogger {
    constructor() {
        this.logs = [];
        this.autoScroll = true;
        this.currentFilter = '';
        this.currentLevel = 'all';
        this.outputElement = null;
        this.maxLogs = 1000; // Limit to prevent memory issues

        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.outputElement = document.getElementById('console-output');
    }

    setupEventListeners() {
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
        const autoScrollCheckbox = document.getElementById('auto-scroll-checkbox');
        if (autoScrollCheckbox) {
            autoScrollCheckbox.addEventListener('change', () => {
                this.autoScroll = autoScrollCheckbox.checked;
            });
        }

        // Filter input
        const filterInput = document.getElementById('log-filter');
        if (filterInput) {
            filterInput.addEventListener('input', () => {
                this.currentFilter = filterInput.value.toLowerCase();
                this.applyFilters();
            });
        }

        // Level select
        const levelSelect = document.getElementById('log-level');
        if (levelSelect) {
            levelSelect.addEventListener('change', () => {
                this.currentLevel = levelSelect.value;
                this.applyFilters();
            });
        }
    }

    log(level, message, source) {
        const entry = {
            timestamp: new Date(),
            level: level,
            message: message,
            source: source
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

    info(message, source) {
        this.log('info', message, source);
    }

    warn(message, source) {
        this.log('warn', message, source);
    }

    error(message, source) {
        this.log('error', message, source);
    }

    success(message, source) {
        this.log('success', message, source);
    }

    displayLogEntry(entry) {
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
        logElement.setAttribute('data-source', entry.source ? entry.source.toLowerCase() : '');

        this.outputElement.appendChild(logElement);

        // Apply current filters to new entry
        this.applyFiltersToElement(logElement);
    }

    applyFilters() {
        if (!this.outputElement) return;

        const entries = this.outputElement.querySelectorAll('.console-log-entry');
        entries.forEach(entry => {
            this.applyFiltersToElement(entry);
        });
    }

    applyFiltersToElement(element) {
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

    clearLogs() {
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

    copyAllLogs() {
        const visibleLogs = this.logs.filter((entry, index) => {
            const element = this.outputElement.children[index];
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

    scrollToBottom() {
        if (this.outputElement) {
            this.outputElement.scrollTop = this.outputElement.scrollHeight;
        }
    }

    updateLogCount() {
        const countElement = document.getElementById('log-count');
        if (countElement) {
            const visibleCount = this.outputElement ? this.outputElement.querySelectorAll('.console-log-entry:not(.filtered)').length : 0;
            countElement.textContent = `${visibleCount} logs`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods for external logging
    logBackupProgress(progress, message) {
        this.info(`[${progress}%] ${message}`, 'Backup');
    }

    logRestoreProgress(progress, message) {
        this.info(`[${progress}%] ${message}`, 'Restore');
    }

    logPackageOperation(operation, packageName, success) {
        if (success) {
            this.success(`${operation} completed: ${packageName}`, 'Package Manager');
        } else {
            this.error(`${operation} failed: ${packageName}`, 'Package Manager');
        }
    }

    logCommand(command, output, success) {
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
