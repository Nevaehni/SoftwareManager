"use strict";
// Mock the contextBridge API
const mockContextBridge = {
    exposeInMainWorld: jest.fn(),
};
// Mock the ipcRenderer API
const mockIpcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
};
jest.mock('electron', () => ({
    contextBridge: mockContextBridge,
    ipcRenderer: mockIpcRenderer,
}));
describe('Preload Script', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules(); // Clear the module cache
    });
    test('Preload_exposes_api_to_renderer', () => {
        // Red phase: Test that preload script exposes API to renderer process
        require('../preload.js');
        expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.objectContaining({
            backupPackages: expect.any(Function),
            restorePackages: expect.any(Function),
            getSettings: expect.any(Function),
            saveSettings: expect.any(Function),
        }));
    });
    test('Preload_backup_calls_main_process', async () => {
        // Red phase: Test that backup function calls main process
        mockIpcRenderer.invoke.mockResolvedValue({ success: true });
        require('../preload.js');
        // Get the exposed API from the mock call
        const exposeCall = mockContextBridge.exposeInMainWorld.mock.calls[0];
        const api = exposeCall[1];
        await api.backupPackages();
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('backup-packages');
    });
    test('Preload_restore_calls_main_process', async () => {
        // Red phase: Test that restore function calls main process
        mockIpcRenderer.invoke.mockResolvedValue({ success: true });
        require('../preload.js');
        // Get the exposed API from the mock call
        const exposeCall = mockContextBridge.exposeInMainWorld.mock.calls[0];
        const api = exposeCall[1];
        const bundlePath = '/path/to/bundle.yaml';
        await api.restorePackages(bundlePath);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('restore-packages', bundlePath);
    });
});
//# sourceMappingURL=preload.spec.js.map