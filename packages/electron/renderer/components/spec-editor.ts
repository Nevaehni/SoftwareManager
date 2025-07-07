/**
 * F-06: YAML/JSON Editor with Validation
 * Built-in Monaco editor with schema validation & diff functionality
 */

// Use dynamic import or global reference for Monaco Editor
declare const monaco: any;

export class SpecEditor {
    private editor: any | null = null;
    private currentFilePath: string | null = null;
    private currentLanguage: 'yaml' | 'json' = 'yaml';

    constructor() {
        this.setupEventListeners();
    }

    public initialize(): void {
        const container = document.getElementById('spec-editor-container');
        if (!container) {
            throw new Error('Editor container not found');
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
    } private configureMonaco(): void {
        // Configure YAML schema validation if supported
        try {
            const yamlLanguages = (monaco.languages as any).yaml;
            if (yamlLanguages && yamlLanguages.yamlDefaults) {
                yamlLanguages.yamlDefaults.setDiagnosticsOptions({
                    validate: true,
                    schemas: [{
                        uri: 'http://softwaremanager.local/backup-spec-schema.json',
                        fileMatch: ['*'],
                        schema: {
                            type: 'object',
                            properties: {
                                packages: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            id: { type: 'string' },
                                            version: { type: 'string' },
                                            source: { type: 'string', enum: ['winget', 'chocolatey'] }
                                        },
                                        required: ['name', 'id']
                                    }
                                },
                                customInstallers: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            path: { type: 'string' },
                                            downloadUrl: { type: 'string' }
                                        },
                                        required: ['name']
                                    }
                                }
                            }
                        }
                    }]
                });
            }
        } catch (error) {
            console.warn('YAML language support not available:', error);
        }

        // Configure JSON schema validation
        if (monaco.languages.json && monaco.languages.json.jsonDefaults) {
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                schemas: [{
                    uri: 'http://softwaremanager.local/backup-spec-schema.json',
                    fileMatch: ['*'],
                    schema: {
                        type: 'object',
                        properties: {
                            packages: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        id: { type: 'string' },
                                        version: { type: 'string' },
                                        source: { type: 'string', enum: ['winget', 'chocolatey'] }
                                    },
                                    required: ['name', 'id']
                                }
                            },
                            customInstallers: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        path: { type: 'string' },
                                        downloadUrl: { type: 'string' }
                                    },
                                    required: ['name']
                                }
                            }
                        }
                    }
                }]
            });
        }
    }

    private setupEventListeners(): void {
        document.addEventListener('DOMContentLoaded', () => {
            // Language switcher
            const languageSelect = document.getElementById('editor-language') as HTMLSelectElement;
            if (languageSelect) {
                languageSelect.addEventListener('change', () => {
                    this.switchLanguage(languageSelect.value as 'yaml' | 'json');
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
        });
    } private switchLanguage(language: 'yaml' | 'json'): void {
        if (!this.editor) return;

        this.currentLanguage = language;
        const model = this.editor.getModel();
        if (model && monaco && monaco.editor) {
            monaco.editor.setModelLanguage(model, language);
        }
        this.updateStatus(`Switched to ${language.toUpperCase()}`);
    }

    private async loadSpecFile(): Promise<void> {
        try {
            const result = await (window as any).electronAPI.loadSpecFile();
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

    private async saveSpecFile(): Promise<void> {
        try {
            const content = this.getContent();
            const result = await (window as any).electronAPI.saveSpecFile(content, this.currentLanguage);
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

    private async validateSpec(): Promise<void> {
        try {
            const content = this.getContent();
            const result = await (window as any).electronAPI.validateSpec(content, this.currentLanguage);

            const errorsDiv = document.getElementById('validation-errors');
            if (errorsDiv) {
                if (result.success) {
                    errorsDiv.innerHTML = '<p class="text-green-600">✅ Specification is valid</p>';
                    this.updateStatus('Validation passed');
                } else {
                    const errorsList = result.errors.map((error: string) => `<li class="text-red-600">❌ ${error}</li>`).join('');
                    errorsDiv.innerHTML = `<ul class="space-y-1">${errorsList}</ul>`;
                    this.updateStatus(`Validation failed: ${result.errors.length} errors found`, true);
                }
            }
        } catch (error) {
            this.updateStatus(`Error validating spec: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
        }
    }

    public setContent(content: string): void {
        if (this.editor) {
            this.editor.setValue(content);
        }
    }

    public getContent(): string {
        return this.editor ? this.editor.getValue() : '';
    }

    public setCurrentFile(filePath: string): void {
        this.currentFilePath = filePath;
        this.updateStatus(`${this.getFileName(filePath)}`);
    }

    private getFileName(filePath: string): string {
        return filePath.split(/[\\/]/).pop() || 'untitled';
    }

    private updateStatus(message: string, isError: boolean = false): void {
        const statusDiv = document.getElementById('editor-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = isError ? 'text-red-600' : 'text-gray-600';
        }
    }

    public dispose(): void {
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
    }
}
