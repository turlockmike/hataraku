/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                "module": "CommonJS",
                "moduleResolution": "node",
                "esModuleInterop": true,
                "allowJs": true
            },
            diagnostics: false,
            isolatedModules: true
        }]
    },
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        '^delay$': '<rootDir>/src/__mocks__/delay.js',
        '^p-wait-for$': '<rootDir>/src/__mocks__/p-wait-for.js',
        '^fast-glob$': '<rootDir>/src/__mocks__/fast-glob.js',
        '^serialize-error$': '<rootDir>/src/__mocks__/serialize-error.js',
        '^strip-ansi$': '<rootDir>/src/__mocks__/strip-ansi.js',
        '^default-shell$': '<rootDir>/src/__mocks__/default-shell.js',
        '^os-name$': '<rootDir>/src/__mocks__/os-name.js'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(delay|p-wait-for|fast-glob|serialize-error|strip-ansi|default-shell|os-name)/)'
    ],
    setupFiles: [],
    forceExit: true,
    detectOpenHandles: true
}
