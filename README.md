# **SoftwareManager – Test‑Driven Development (TDD) Plan**

*(Release 1.0 — Windows‑only, 5 July 2025)*

---

## 1 · Purpose

This document defines **how** we will build SoftwareManager under a **Test‑Driven Development** discipline:

* **Write a failing test → write minimal code → refactor** is mandatory for every commit.
* “Green main = ship” — all branches must merge through CI that enforces 100 % pass rate, coverage gates and lint/static‑analysis checks.

---

## 2 · TDD Workflow

| Step         | Action                                                        | Outcome                           |
| ------------ | ------------------------------------------------------------- | --------------------------------- |
| **Red**      | Describe behaviour as a test (unit or higher) and run it.     | Fails (no implementation).        |
| **Green**    | Write *just enough* prod code to satisfy the test.            | Test suite passes.                |
| **Refactor** | Improve implementation and/or tests with no behaviour change. | Tests still pass; code quality ↑. |
| **Commit**   | Squash to logical unit; open PR.                              | CI runs full pyramid.             |

> **Rule of thumb:** *No production code without a failing test; no test without clear assertion.*

---

## 3 · Testing Layers & Scope

| Layer                            | Tools                                              | Key targets                                                                | Required coverage                 |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------- |
| **Unit** (logic, pure functions) | Jest + ts‑jest, Sinon                              | `core/**`, business rules, data models                                     | **≥ 90 %** lines/branches         |
| **Contract / Adapter**           | Jest + mocked stubs                                | Each `PackageAdapter`, `ConfigAdapter` must satisfy shared interface tests | **100 %** method assertions       |
| **Integration**                  | Jest + real child processes (stubbed Winget/Choco) | Interaction among adapters, bundle creation, restore pipeline              | Run on every PR                   |
| **End‑to‑End (E2E)**             | Playwright (Chromium)                              | Renderer↔Main=IPC, UI flows: backup, restore, settings drag‑n‑drop         | Smoke set on PR; full set nightly |
| **Smoke / Regression**           | Node script                                        | “SoftwareManager ‑‑version”; CLI exports; launch app                       | Every build artifact              |

### The Test Pyramid

```
    UI / E2E     ← dozens, slow
  Integration     ← hundreds
 Contract / Adapter
    Unit         ← thousands, fast
```

---

## 4 · Test Toolchain

| Purpose                       | Choice                                                                   | Rationale                                                          |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Unit / Contract / Integration | **Jest 30 + ts‑jest**                                                    | Most Node/Electron libs mock‑friendly; snapshot tests.             |
| Mock/Spy                      | **Sinon**                                                                | Clock, stub, fake timers for async CLI polling.                    |
| Coverage                      | **Istanbul (nyc)** via Jest                                              | HTML + LCOV; fail PR if `--check-coverage` thresholds unmet.       |
| UI / E2E                      | **Playwright 1.46**                                                      | Handles Electron via *playwright‑electron* helper; headless in CI. |
| Fixture CLIs                  | Custom stub binaries (Winget, Choco, Scoop) generated in test bootstrap. |                                                                    |
| Static analysis               | ESLint, TypeScript strict, Prettier.                                     |                                                                    |
| CI                            | GitHub Actions + Windows Server 2022 runner.                             |                                                                    |
| Artifact isolation            | **Vitest test environment** for optional in‑memory DOM in unit tests.    |                                                                    |

---

## 5 · Project & Test Folder Layout

```
packages/
  core/
    src/...
    __tests__/
      backup-service.spec.ts
      bundle.spec.ts
  adapters/
    windows/
      winget-adapter.ts
      registry-adapter.ts
      __tests__/
        winget-adapter.contract.spec.ts
  electron/
    main/
    preload/
    renderer/
      components/
      __tests__/            # component unit tests with React Testing Library
  e2e/
    backup-restore.spec.ts
    settings-priority.spec.ts
stubs/
  winget/winget.cmd         # echo JSON fixtures
  choco/choco.cmd
```

*Tests live **next to** the code they cover; E2E resides in /e2e.*

---

## 6 · Acceptance Criteria & High‑Level Scenarios (Gherkin)

| Epic            | Feature                                  | Scenario (Given / When / Then)                                                                                                              |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backup**      | Select packages                          | *Given* Git 2.42.0 installed… *When* I tick “Git” … *Then* `spec.yaml` contains `"Git.Git"` with version 2.42.0                             |
|                 | Include PuTTY sessions                   | *Given* PuTTY sessions exist… *When* I run backup… *Then* ZIP contains `payload/Files/PuTTY/Sessions.reg`                                   |
| **Restore**     | Handle missing Winget pkg → fallback URL | *Given* package “FancyTool” only in extras.json… *Then* MSIExeSvc downloads & installs; exit code 0                                         |
| **Settings**    | Priority order respected                 | *Given* Choco > Winget… *When* installing “Git” present in both repos… *Then* Choco’s command invoked first                                 |
| **Bootstrap**   | Install missing Chocolatey               | *Given* Choco absent… *When* I click Install… *Then* `choco -v` succeeds and settings shows ✅                                               |
| **Editor**      | Invalid YAML shows error                 | *Given* I break indentation… *Then* Monaco marks red squiggles; Save disabled                                                               |
| **Version pin** | Downgrade package                        | *Given* Git 2.44.1 present… *When* I select Downgrade → 2.35.0… *Then* `winget install ... --version 2.35.0` executed and list shows 2.35.0 |

*Each scenario becomes an E2E Playwright test plus underlying unit tests.*

---

## 7 · Unit‑Test Specifications (samples)

### 7.1 BackupService

| Behaviour                              | Test ID                          | Assertions                                                |
| -------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| Creates bundle dir structure           | `BackupService_createsDirs`      | After `run()`, expect `fs.existsSync(tmp/spec.yaml)` etc. |
| Delegates to PackageAdapter.exportList | `BackupService_callsExport`      | Sinon spy called with correct filename.                   |
| Skips disabled managers                | `BackupService_respectsSettings` | Given settings disable choco, expect no choco calls.      |

### 7.2 WingetAdapter

| Behaviour                             | Test ID                  | Setup / Expect                                       |
| ------------------------------------- | ------------------------ | ---------------------------------------------------- |
| `search()` parses JSON output         | `Winget_search_parses`   | Stub child\_process return; expect array length > 0. |
| `install(version)` pins version       | `Winget_install_version` | Expect spawned args include `--version 2.35.0`.      |
| `ensurePresent()` false when exit ≠ 0 | `Winget_ensure_absent`   | Fake exitCode 1; expect false.                       |

### 7.3 BootstrapSvc

*Uses fake PowerShell script returning exit 0.*
Test that **when** Winget absent **and** user chooses install **then** `BootstrapSvc.run('winget')` downloads MSIX and ensurePresent() passes.

---

## 8 · Contract Tests for Adapters

Create **shared test suite** (`adapterContract.ts`) that any adapter must pass:

```ts
export function shouldBehaveLikePackageAdapter(factory: () => PackageAdapter) {
  describe('PackageAdapter contract', () => {
    it('listInstalled returns version for each package', async () => { … });
    it('install then listInstalled includes package',     async () => { … });
    …
  });
}
```

Each concrete adapter imports and executes with its own factory:

```ts
describe('WingetAdapter', () =>
  shouldBehaveLikePackageAdapter(() => new WingetAdapter(stubExec)));
```

*Guarantees parity when macOS/Linux adapters arrive.*

---

## 9 · E2E Test Architecture

* **playwright.config.ts** launches SoftwareManager via Electron’s main executable.
* Use **fixtures account** (non‑admin) — Playwright requests elevation through UI and asserts UAC window closes.
* **Winget/Choco network calls disabled** by pointing to local stub repository so CI is deterministic.
* Nightly job runs full UI suite on real Winget (GitHub Windows runner).

---

## 10 · Continuous Integration Pipeline (GitHub Actions)

```yaml
name: CI
on: [push, pull_request]

jobs:
  lint-unit:
    runs-on: windows-2022
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run test:unit -- --coverage
      - run: pnpm exec nyc check-coverage --branches 90 --lines 90

  contract-int:
    needs: lint-unit
    runs-on: windows-2022
    steps:
      - run: pnpm run test:contract
      - run: pnpm run test:integration

  e2e:
    needs: contract-int
    runs-on: windows-2022
    steps:
      - run: pnpm exec playwright install --with-deps
      - run: pnpm run test:e2e

  build:
    needs: e2e
    if: github.ref == 'refs/heads/main' && success()
    steps:
      - run: pnpm run build
      - run: pnpm run publish
```

*Build step only executes when all tests pass.*

---

## 11 · Definition of Done (per story)

1. Failing test reproduced.
2. Minimal code implemented; test suite green.
3. No uncovered new logic (coverage gate unchanged).
4. ESLint and Prettier pass.
5. Documentation string or Storybook entry added for any UI component.
6. Story accepted by Product Owner.

---

## 12 · Extending TDD to macOS / Linux (post‑v1)

* Add *brew*, *apt* adapters; plug them into shared contract suite — they **must pass unchanged tests**.
* Spin CI jobs on macOS‑hosted runner and Ubuntu 22.04.
* UI E2E tests stay identical; only adapter stubs switch.

---

## 13 · Templates & Examples

### 13.1 Sample Jest test

```ts
import { WingetAdapter } from '../winget-adapter';
import sinon from 'sinon';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execStub = sinon.stub().resolves({ stdout: '{ "Installed": [] }', stderr: '' });
const adapter = new WingetAdapter(execStub as unknown as typeof execFile & promisify);

test('ensurePresent passes when winget returns 0', async () => {
  execStub.resolves({ stdout: '', stderr: '', exitCode: 0 });
  expect(await adapter.ensurePresent()).toBe(true);
});
```

### 13.2 Sample Playwright test

```ts
import { _electron as electron } from 'playwright';
import path from 'path';

test('create and restore backup', async () => {
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main.js')]});
  const page = await app.firstWindow();

  await page.click('text=Backup');
  await page.click('text=Select All Packages');
  await page.click('text=Generate Backup');
  await page.waitForSelector('text=Backup completed');

  // simulate fresh state
  await page.click('text=Restore');
  await page.setInputFiles('input[type=file]', 'C:\\tmp\\backup.zip');
  await page.click('text=Run');
  await page.waitForSelector('text=Restore finished');

  await app.close();
});
```

---

## 14 · Governance

* **Testing Chief** (rotating weekly) reviews that every PR adheres to TDD checklist.
* **Agile board**: a User Story is not “In Review” until at least one failing test exists.
* **Bug fix SLA**: write reproduction test first; red‑green‑refactor; reference issue number in commit.

---

### **Summary**

This TDD plan makes every behaviour of SoftwareManager *executable specification*.
By mandating tests **first**, shared contract suites, and an enforced CI gate, we:

* Catch regressions early.
* Keep Windows, macOS, Linux adapters consistent.
* Produce living documentation that on‑boards new contributors quickly.

Adhering to this document is **non‑negotiable** for v 1.0 and all future releases.

---

## 15 · TDD Progress Tracking

*Last updated: July 6, 2025*

### ✅ **Completed Features**

| Layer | Component | Test ID | Status | Implementation |
|-------|-----------|---------|--------|----------------|
| **Unit** | BackupService | `BackupService_createsDirs` | ✅ PASS | Creates `tmp/spec.yaml` |
| **Unit** | BackupService | `BackupService_callsExport` | ✅ PASS | Delegates to `PackageAdapter.exportList()` |
| **Unit** | BackupService | `BackupService_respectsSettings` | ✅ PASS | Skips export when `enableChoco: false` |
| **Contract** | WingetAdapter | `PackageAdapter contract` | ✅ PASS | Implements `exportList()` interface |
| **Unit** | WingetAdapter | `Winget_search_parses` | ✅ PASS | Parse JSON output from `winget search` |
| **Unit** | WingetAdapter | `Winget_install_version` | ✅ PASS | Pin version in install command |
| **Unit** | WingetAdapter | `Winget_ensure_absent` | ✅ PASS | Return false when exit code ≠ 0 |

### 🔄 **In Progress**

*None currently*

### 📋 **Next Up (Priority Order)**

| Layer | Component | Test ID | Description |
|-------|-----------|---------|-------------|
| **Integration** | Bundle Creation | `Bundle_includes_packages` | End-to-end backup flow |
| **E2E** | UI Flow | `backup-restore.spec.ts` | Playwright test for full workflow |

### 📊 **Current Metrics**

- **Test Suites**: 3 passing
- **Total Tests**: 7 passing (0 failing)
- **Coverage**: 100% for implemented features
- **TDD Cycles Completed**: 7
- **Contract Tests**: 1 (WingetAdapter)

### 🎯 **Sprint Goals**

1. **Current Sprint**: ✅ Complete WingetAdapter unit tests (section 7.2) - **COMPLETED**
2. **Next Sprint**: Integration tests with stubbed child processes
3. **Future**: E2E tests with Playwright + Electron
