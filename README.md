# SoftwareManager

**A comprehensive package-backup, restore & day-to-day package-management tool for Windows**  

[![Tests](https://img.shields.io/badge/tests-56%20passing-brightgreen)](./package.json)  
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](./package.json)  
[![Electron](https://img.shields.io/badge/Electron-37.2.0-47848f)](./package.json)  
[![Version](https://img.shields.io/badge/version-1.0.0-success)](./packages/cli/software-manager.ts)

SoftwareManager lets you **back up, restore and actively manage** your installed software across Windows package managers (Winget, Chocolatey).  
Built 100 % with **Test-Driven Development (TDD)**, it ships a CLI *and* a modern Electron GUI.

---

## ✨ Feature Overview

| Category | Delivered | Missing → must ship in v1.0 |
|----------|-----------|-----------------------------|
| **Backup & Restore** | ✔ Back up installed packages with progress feedback<br>✔ Restore from a bundle | ▢ **Selective config picker** (folders, files, Registry)<br>▢ **Version pinning** per package in backup |
| **Package Management (daily use)** | ✔ **Search & install packages** with UI<br>✔ **Uninstall packages with UI**<br>✔ **Winget & Chocolatey integration** | — |
| **Package-Manager Bootstrap** | ✔ **One-click install** of Winget / Chocolatey when missing | ▢ Settings UI: **drag-and-drop priority list** of managers |
| **Priority Ordering** | ✔ Settings UI: **drag-and-drop priority list** of managers | — |
| **Custom Installer Support** | — | ▢ **Add MSI/EXE** files, include in backup & restore |
| **Spec Editor** | — | ▢ Built-in **YAML/JSON editor** (Monaco) with schema validation & diff |
| **Console / Log Viewer** | — | ▢ Toggleable pane streaming stdout/stderr; copy & filter |
| **Restore Preview** | — | ▢ **Differential report** (new / upgrade / downgrade) before restoring |
| **Auto-Update (app)** | — | ▢ Self-update check & download |
| **Accessibility / Theme** | — | ▢ Dark-/light-theme toggle, keyboard navigation |
| **E2E Coverage** | 🕒 Planned | ▢ Playwright tests for all the above |

### 🔧 Recent Implementation Notes

**F-04: Uninstall packages with UI - COMPLETED** ✅  
The package uninstall functionality has been fully implemented and tested. Key technical solutions:

- **Adapter Extension**: Added `uninstall()` method to `PackageAdapter` interface and implemented in both WingetAdapter and ChocoAdapter
- **UI Enhancement**: Extended package management UI with tabbed interface - "Search & Install" and "Installed Packages" views
- **IPC Integration**: Added `uninstall-package` and `list-installed-packages` IPC handlers in main process
- **E2E Testing**: Comprehensive E2E tests covering tab navigation, package listing, and uninstall functionality
- **Error Handling**: Proper status feedback and error handling for uninstall operations
- **Scrollable Lists**: Added responsive scrolling to package lists with visual indicators when content overflows

Users can now view installed packages, navigate between search and installed views, and uninstall packages directly from the UI with real-time feedback. Package lists automatically become scrollable when containing many items with adaptive height constraints.

**F-03: Search & Install Packages (UI) - COMPLETED** ✅  
The package search functionality has been fully implemented and tested. Key technical solutions:

- **Module Compatibility**: Created browser-compatible JavaScript version (`package-search-ui-browser.js`) to avoid CommonJS export issues
- **Winget Integration**: Fixed table output parsing to handle real winget command output format instead of expecting JSON
- **UI Initialization**: Resolved timing issues where PackageSearchUI wasn't initialized when already on packages section
- **Type Safety**: Added `source` field to `PackageInfo` interface to distinguish between winget/chocolatey packages

Users can now search for packages (e.g., "discord"), see live results with install buttons, and install directly from the UI.

**📜 Package List Scrolling Enhancement - COMPLETED** ✅  
Enhanced the package management interface with comprehensive scrolling functionality for better usability when dealing with large numbers of packages:

- **Responsive Height Constraints**: Package lists use adaptive height (`min(24rem, calc(100vh - 400px))`) that automatically adjusts to viewport size
- **Custom Scrollbar Styling**: Beautiful custom scrollbars with consistent design across the application
- **Smart Overflow Management**: Containers only display scrollbars when content actually overflows, maintaining clean UI for shorter lists
- **Visual Scroll Indicators**: Subtle gradient overlays appear at the bottom of containers when more content is available to scroll
- **Dynamic State Management**: JavaScript logic automatically detects scrollable content and applies appropriate CSS classes
- **E2E Test Coverage**: Comprehensive tests verify proper CSS classes, responsive behavior, and UI structure

Both search results and installed packages lists now provide smooth, professional scrolling experiences that scale gracefully with content size.

> **TDD rule:**  
> _No user-facing feature in the "Missing" column may be implemented without first committing a failing test (unit, contract, integration or E2E as appropriate)._

---

## 🚀 Quick Start

### Prerequisites

- **Windows 10/11** (primary platform)
- **Node.js 18+** and **pnpm** package manager
- **Winget** and/or **Chocolatey** installed (optional but recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SoftwareManager.git
   cd SoftwareManager
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the project**
   ```bash
   pnpm build
   ```

---

### Prerequisites

- **Windows 10/11** (primary platform)
- **Node.js 18+** and **pnpm** package manager
- **Winget** and/or **Chocolatey** installed (optional but recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SoftwareManager.git
   cd SoftwareManager
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the project**
   ```bash
   pnpm build
   ```

## 📋 Usage

### Command Line Interface

SoftwareManager provides a full-featured CLI for automation and scripting:

```bash
# Show help
node dist/packages/cli/software-manager.js --help

# Create a backup
node dist/packages/cli/software-manager.js backup
node dist/packages/cli/software-manager.js backup my-backup.yaml

# Restore from backup
node dist/packages/cli/software-manager.js restore my-backup.yaml

# List installed packages
node dist/packages/cli/software-manager.js list

# Install missing package managers
node dist/packages/cli/software-manager.js bootstrap

# Show version
node dist/packages/cli/software-manager.js version

# Backup without Chocolatey
node dist/packages/cli/software-manager.js backup --no-choco

# Backup without Winget
node dist/packages/cli/software-manager.js backup --no-winget
```

### GUI Application

Launch the modern Electron interface:

```bash
pnpm start
```

The GUI provides:
- **Visual package selection** for backups
- **Drag-and-drop restore** functionality
- **Settings management** with package manager preferences
- **Progress tracking** with real-time feedback
- **Professional styling** with Tailwind CSS utility-first framework
- **Modern responsive design** optimized for desktop use
- **Scrollable package lists** with adaptive height and custom scrollbars
- **Smart overflow management** that only shows scrolling when needed

---

## 📌 v1.0 User-Facing Feature Checklist   <!-- CI parses this table -->

| ID   | Feature                                              | Status | Test Suite                            |
|------|------------------------------------------------------|--------|---------------------------------------|
| F-01 | One-click Winget/Choco bootstrap                      | ✅     | `bootstrap.spec.ts`                   |
| F-02 | Manager priority drag-and-drop                        | ✅     | `settings-priority.e2e.ts`            |
| F-03 | Search & install packages (UI)                        | ✅     | `packages-search.e2e.ts`<br>`winget-adapter.contract.ts` |
| F-04 | Uninstall packages with UI                            | ✅     | `package-uninstall.spec.ts`          |
| F-05 | Add custom MSI/EXE to bundle                          | ❌     | `msi-ingest.spec.ts`                  |
| F-06 | YAML/JSON editor with validation                      | ❌     | `editor.spec.ts`                      |
| F-07 | Console/log viewer (toggle, copy, filter)             | ❌     | `console-pane.spec.ts`                |
| F-08 | Selective config backup (files/registry)              | ❌     | `config-picker.e2e.ts`                |
| F-09 | Version pinning option in backup wizard               | ❌     | `backup-pin.spec.ts`                  |
| F-10 | Differential restore preview                          | ❌     | `restore-diff.e2e.ts`                 |
| F-11 | Auto-update for SoftwareManager                       | ❌     | `auto-update.spec.ts`                 |
| F-12 | Accessibility & dark/light theme                      | ❌     | `a11y-theme.e2e.ts`                   |

*The CI pipeline fails if any entry marked ❌ lacks at least one **failing-then-passing** test.*

---

## 🎨 Technology Stack

**Frontend & Styling:**
- **Tailwind CSS 4.1.11** - Utility-first CSS framework for rapid UI development
- **Vanilla JavaScript/TypeScript** - No frontend framework dependencies
- **Electron** - Cross-platform desktop app framework

**Backend & Core:**
- **Node.js 18+** - Runtime environment
- **TypeScript 5.8.3** - Type-safe JavaScript
- **Jest** - Testing framework with 90%+ coverage requirement

**Package Managers Supported:**
- **Winget** - Windows Package Manager (built-in Windows 10/11)  
- **Chocolatey** - The package manager for Windows

---

## 🏗️ Architecture

SoftwareManager follows a clean, modular architecture:

```
packages/
├── core/                    # Business logic & services
│   ├── backup-service.ts    # Backup orchestration
│   ├── restore-service.ts   # Restore operations
│   ├── settings.ts          # Configuration management
│   └── package-manager-detector.ts
├── adapters/                # Package manager integrations
│   └── windows/
│       ├── winget-adapter.ts    # Windows Package Manager
│       └── choco-adapter.ts     # Chocolatey
├── cli/                     # Command-line interface
│   └── software-manager.ts
├── electron/                # Desktop GUI application
│   ├── main/               # Electron main process
│   ├── preload/           # Security bridge
│   └── renderer/          # UI components
└── integration/           # Cross-component tests
```

### Key Components

- **BackupService**: Orchestrates package export across managers
- **RestoreService**: Handles package installation from backups
- **PackageAdapters**: Abstract interface for different package managers
- **Settings**: Persistent configuration with JSON storage
- **CLI**: Full command-line interface with progress reporting
- **Electron App**: Cross-platform desktop GUI
- **ScrollableUI**: Responsive package list containers with adaptive scrolling

#### Package List Scrolling Architecture

The scrolling system implements a layered approach for optimal user experience:

**CSS Layer:**
- `.package-list-container` - Base scrollable container with responsive height constraints
- `.custom-scrollbar` - Styled scrollbars with smooth behavior and hover effects
- `.has-items` - Dynamic class applied when content is present
- `.is-scrollable` - Visual indicator class for overflow state

**JavaScript Layer:**
- `checkScrollable()` utility function detects when containers need scrolling
- Dynamic class management for real-time visual feedback
- Scroll event listeners for responsive indicator updates
- Integration with both TypeScript (main) and browser-compatible JavaScript versions

**Responsive Design:**
- Height constraints use CSS `min()` function for viewport adaptation
- Gradient overlays provide visual cues for additional content
- Smooth animations and transitions for professional feel

---

## 🧪 Testing (TDD)

**Development mantra:** **Red → Green → Refactor → Commit.**  
Every feature above must enter the code-base via a branch that:

1. Adds a failing test addressing the acceptance criteria  
2. Implements the minimal code to pass  
3. Refactors with tests still green  
4. Passes coverage gates (`nyc check-coverage --branches 90 --lines 90`)  
5. Is squash-merged through CI

Run the whole pyramid:

```bash
pnpm test            # unit + contract + integration
pnpm test:e2e        # Playwright (GUI)
pnpm test --coverage # + coverage gate
```

**Scrolling Feature Testing:**
- `package-scrolling-ui.spec.ts` - E2E tests for CSS classes and UI structure
- Unit tests verify scroll detection logic in package search components
- Integration tests ensure scrolling works across different content scenarios
- All tests pass without breaking existing functionality

---

## 📊 Project Status

### ✅ Completed (test-green features)

*see first column of Feature Overview*

### 🚧 Pending (must turn green before v1.0 release)

*all "Missing" items in Feature Overview / Checklist*

---

## ⏭ Roadmap (post-v1)

* Cloud backup (encrypted)
* Bulk operations from CLI (`install <bundle>.zip` straight to fresh PC)
* Additional package manager support as requested by community

---

## 📄 License & Support

This project is licensed under the ISC License. See the [package.json](./package.json) file for details.

- **Issues**: Report bugs and feature requests via GitHub Issues
- **Documentation**: This README and inline code documentation
- **Tests**: Run `pnpm test` to verify functionality

---

**This README is itself part of the TDD contract.**
Updating a feature's **Status** from ❌ to ✅ is only allowed in the same pull-request that lands the passing test(s) and implementation.
