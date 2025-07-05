# Software Manager - Electron Development Guide

## Project Overview

This is the new **Electron branch** of Software Manager - a cross-platform desktop GUI built with **Electron**, **React/TypeScript**, **Tailwind CSS**, and **shadcn/ui**. The application wraps the original PowerShell engine while providing a clean, modern interface.

## Project Structure

```
SoftwareManager/
├── _old/                          # Original PowerShell scripts and files
│   ├── SoftwareManager.ps1        # Main PowerShell script
│   ├── ConfigMappings.ps1         # Configuration mappings
│   ├── packages.txt               # Package list
│   └── ...                       # Other original files
├── electron/                      # Electron main process files
│   ├── main.js                    # Main Electron process
│   └── preload.js                 # Preload script for secure IPC
├── src/                           # React frontend source
│   ├── components/                # React components
│   │   └── ui/                    # shadcn/ui components
│   ├── lib/                       # Utility functions
│   ├── App.tsx                    # Main React app
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Global styles with Tailwind
├── public/                        # Static assets
├── assets/                        # App icons and resources
├── package.json                   # Dependencies and scripts
├── vite.config.ts                 # Vite configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
└── postcss.config.js             # PostCSS configuration
```

## Features

- **Cross-platform desktop app** built with Electron
- **Modern React/TypeScript frontend** with Tailwind CSS styling
- **shadcn/ui components** for consistent, accessible UI
- **Secure IPC communication** between renderer and main process
- **Real-time PowerShell output** streaming to the frontend
- **File selection dialogs** for configs and package lists
- **Progress tracking** for long-running operations
- **Terminal-like output** display with syntax highlighting

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- PowerShell 7+ (for the underlying engine)
- Windows (recommended, though the app is designed to be cross-platform)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```
   This runs both the React dev server (Vite) and Electron concurrently.

### Available Scripts

- `npm run dev` - Start both React and Electron in development mode
- `npm run dev:react` - Start only the React dev server
- `npm run dev:electron` - Start only Electron (requires React server running)
- `npm run build` - Build the React app for production
- `npm run dist` - Build and package the complete Electron app
- `npm run electron` - Run Electron with the built React app

### Building for Production

1. **Build the React app:**
   ```bash
   npm run build
   ```

2. **Package the Electron app:**
   ```bash
   npm run dist
   ```

This creates platform-specific installers in the `release/` directory.

## Architecture

### Electron Main Process (`electron/main.js`)

- Creates the main application window
- Handles IPC communication with the renderer
- Executes PowerShell scripts securely
- Manages file dialogs and system integration
- Streams PowerShell output to the frontend

### Preload Script (`electron/preload.js`)

- Provides secure bridge between main and renderer processes
- Exposes limited APIs to the frontend via `window.electronAPI`
- Ensures security through context isolation

### React Frontend (`src/`)

- **Modern UI** built with React 18 and TypeScript
- **Responsive design** using Tailwind CSS
- **Component library** using shadcn/ui for consistency
- **Real-time updates** through Electron IPC
- **State management** with React hooks

### PowerShell Integration

The app integrates with the original PowerShell scripts in the `_old/` directory:

- **Development mode**: Uses scripts directly from `_old/`
- **Production mode**: Scripts are bundled into the app package
- **Stream output**: Real-time PowerShell output appears in the UI
- **Error handling**: Both stdout and stderr are captured and displayed

## UI Components

The app uses a modern component architecture:

### Core UI Elements

- **Tabs**: Switch between Backup, Restore, and Settings modes
- **Cards**: Organize functionality into logical sections
- **Buttons**: Consistent styling with multiple variants
- **Progress bars**: Visual feedback for operations
- **Terminal output**: Real-time command output display

### Features

1. **Backup Mode**:
   - Select package list file
   - Start backup operation
   - Monitor progress and output

2. **Install & Restore Mode**:
   - Select package list and config archive
   - Install packages via Chocolatey
   - Restore configurations
   - Monitor installation progress

3. **Settings** (Future):
   - Configuration options
   - Preferences management

## Development Notes

### Security

- Uses Electron's security best practices
- Context isolation enabled
- Node integration disabled in renderer
- Secure IPC through preload script

### Performance

- Vite for fast development and optimized builds
- React 18 with concurrent features
- Minimal bundle size with tree shaking
- Efficient PowerShell process management

### Cross-platform Considerations

- Electron provides cross-platform compatibility
- PowerShell Core works on Windows, macOS, and Linux
- File paths handled appropriately for each OS
- Native dialogs adapt to platform conventions

## Future Enhancements

1. **Enhanced Settings Panel**:
   - GUI for editing package lists
   - Configuration mapping management
   - PowerShell execution preferences

2. **Package Management**:
   - Browse and search Chocolatey packages
   - Visual package selection interface
   - Dependency visualization

3. **Advanced Features**:
   - Scheduled backups
   - Cloud storage integration
   - Configuration diff viewer
   - Batch operations

## Troubleshooting

### Common Issues

1. **"Electron API not available"**:
   - Ensure preload script is loading correctly
   - Check that context isolation is enabled

2. **PowerShell execution fails**:
   - Verify PowerShell 7+ is installed
   - Check execution policy settings
   - Ensure scripts exist in `_old/` directory

3. **Build failures**:
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify all dependencies are installed

### Development Tips

- Use browser dev tools in Electron for debugging
- Check Electron console for main process errors
- Use React dev tools for component debugging
- Monitor PowerShell output for script issues

## Contributing

1. Follow the existing code style and conventions
2. Test both development and production builds
3. Ensure cross-platform compatibility
4. Update documentation for new features
5. Test PowerShell integration thoroughly

## License

This project maintains the same license as the original Software Manager.
