
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  projects: [{
    displayName: 'node',
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/packages'],
    testMatch: ['<rootDir>/packages/**/__tests__/**/*.spec.ts'], testPathIgnorePatterns: [
      '<rootDir>/packages/electron/renderer/components/__tests__/package-search-ui.spec.ts',
      '<rootDir>/packages/electron/renderer/components/__tests__/yaml-json-editor.spec.ts',
      '<rootDir>/packages/electron/renderer/components/__tests__/editor-*.spec.ts',
      '<rootDir>/packages/electron/renderer/components/__tests__/console-logger.spec.ts'
    ]
  }, {
    displayName: 'jsdom',
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/packages'], testMatch: [
      '<rootDir>/packages/electron/renderer/components/__tests__/package-search-ui.spec.ts',
      '<rootDir>/packages/electron/renderer/components/__tests__/yaml-json-editor.spec.ts',
      '<rootDir>/packages/electron/renderer/components/__tests__/editor-*.spec.ts',
      '<rootDir>/packages/electron/renderer/components/__tests__/console-logger.spec.ts'
    ]
  }
  ]
};
