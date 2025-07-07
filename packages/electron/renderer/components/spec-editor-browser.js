/**
 * F-06: YAML/JSON Editor with Validation
 * Browser-compatible version of SpecEditor using Monaco Editor from CDN
 */

class SpecEditor {
    constructor() {
        this.editor = null;
        this.currentFilePath = null;
        this.currentLanguage = 'yaml';
        this.setupEventListeners();
    }

    async initialize() {
        const container = document.getElementById('spec-editor-container');
        if (!container) {
            throw new Error('Editor container not found');
        }

        // Load Monaco Editor from CDN if not already loaded
        if (typeof monaco === 'undefined') {
            await this.loadMonacoEditor();
        }

        // Configure Monaco Editor for YAML and JSON
        this.configureMonaco();

        // Create the editor instance
        this.editor = monaco.editor.create(container, {
            value: '',
            language: 'yaml',
            theme: 'vs-light',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
        });

        // Update status
        this.updateStatus('Ready');
    }

    async loadMonacoEditor() {
        return new Promise((resolve, reject) => {
            // Load Monaco Editor from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/loader.js';
            script.onload = () => {
                require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' } });
                require(['vs/editor/editor.main'], resolve);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    configureMonaco() {
        // Skip detailed schema configuration for now - this would need
        // additional monaco-yaml plugin for full YAML support
        console.log('Monaco editor configured');
    }

    setupEventListeners() {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            // Language switcher
            const languageSelect = document.getElementById('editor-language');
            if (languageSelect) {
                languageSelect.addEventListener('change', () => {
                    this.switchLanguage(languageSelect.value);
                });
            }

            // Load button
            const loadBtn = document.getElementById('load-spec-btn');
            if (loadBtn) {
                loadBtn.addEventListener('click', () => {
                    this.loadSpecFile();
                });
            }

            // Save button
            const saveBtn = document.getElementById('save-spec-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    this.saveSpecFile();
                });
            }

            // Validate button
            const validateBtn = document.getElementById('validate-spec-btn');
            if (validateBtn) {
                validateBtn.addEventListener('click', () => {
                    this.validateSpec();
                });
            }
        }, 100);
    }

    switchLanguage(language) {
        if (!this.editor) return;

        this.currentLanguage = language;
        const model = this.editor.getModel();
        if (model && monaco && monaco.editor) {
            monaco.editor.setModelLanguage(model, language);
        }
        this.updateStatus(`Switched to ${language.toUpperCase()}`);
    }

    async loadSpecFile() {
        try {
            const result = await window.electronAPI.loadSpecFile();
            if (result.success) {
                this.setContent(result.content);
                this.setCurrentFile(result.filePath);
                this.updateStatus(`Loaded: ${this.getFileName(result.filePath)}`);
            } else {
                this.updateStatus(`Failed to load file: ${result.error}`, true);
            }
        } catch (error) {
            this.updateStatus(`Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
        }
    }

    async saveSpecFile() {
        try {
            const content = this.getContent();
            const result = await window.electronAPI.saveSpecFile(content, this.currentLanguage);
            if (result.success) {
                this.setCurrentFile(result.filePath);
                this.updateStatus(`Saved: ${this.getFileName(result.filePath)}`);
            } else {
                this.updateStatus(`Failed to save file: ${result.error}`, true);
            }
        } catch (error) {
            this.updateStatus(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
        }
    }

    async validateSpec() {
        try {
            const content = this.getContent();
            const result = await window.electronAPI.validateSpec(content, this.currentLanguage);

            const errorsDiv = document.getElementById('validation-errors');
            if (errorsDiv) {
                if (result.success) {
                    errorsDiv.innerHTML = '<div class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg"><p>✅ Specification is valid</p></div>';
                    this.updateStatus('Validation passed');
                } else {
                    const errorsList = result.errors.map((error) => `<li class="text-red-600">❌ ${this.escapeHtml(error)}</li>`).join('');
                    errorsDiv.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"><ul class="space-y-1">${errorsList}</ul></div>`;
                    this.updateStatus(`Validation failed: ${result.errors.length} errors found`, true);
                }
            }
        } catch (error) {
            this.updateStatus(`Error validating spec: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
        }
    }

    setContent(content) {
        if (this.editor) {
            this.editor.setValue(content);
        }
    }

    getContent() {
        return this.editor ? this.editor.getValue() : '';
    }

    setCurrentFile(filePath) {
        this.currentFilePath = filePath;
        this.updateStatus(`${this.getFileName(filePath)}`);
    }

    getFileName(filePath) {
        return filePath.split(/[\\/]/).pop() || 'untitled';
    }

    updateStatus(message, isError = false) {
        const statusDiv = document.getElementById('editor-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = isError ? 'text-red-600' : 'text-gray-600';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    dispose() {
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
    }
}
