import { getFilesInCurrentDirectory, getEnvironmentInfo } from '../environment';
import { readdirSync } from 'node:fs';
import * as os from 'node:os';

// Mock the fs module
jest.mock('node:fs', () => ({
    readdirSync: jest.fn()
}));

// Mock os module
jest.mock('node:os', () => ({
    ...jest.requireActual('node:os'),
    homedir: jest.fn(),
    platform: jest.fn(),
    release: jest.fn(),
    arch: jest.fn(),
    cpus: jest.fn(),
    totalmem: jest.fn(),
    freemem: jest.fn(),
    userInfo: jest.fn()
}));

// Mock process.cwd and other process values
const mockCwd = '/home/runner/work/hataraku/hataraku';
const mockHomedir = '/home/runner';
process.cwd = jest.fn().mockReturnValue(mockCwd);
process.env.TERM_PROGRAM = undefined;

// Mock child_process
jest.mock('child_process', () => ({
    execSync: jest.fn().mockReturnValue(Buffer.from('HEAD'))
}));

// Setup consistent date/time for all tests
beforeEach(() => {
    // Mock Date to ensure consistent timestamp
    const mockDate = new Date('2025-02-19T20:18:28.000Z'); // UTC time matching CI
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    // Set timezone to UTC
    process.env.TZ = 'UTC';
    // Mock Intl.DateTimeFormat to ensure consistent locale and timezone
    const mockDateTimeFormat = {
        resolvedOptions: () => ({
            locale: 'en-US',
            timeZone: 'UTC'
        })
    };
    global.Intl.DateTimeFormat = jest.fn(() => mockDateTimeFormat);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('getFilesInCurrentDirectory', () => {
    beforeEach(() => {
        // Clear mocks before each test
        (readdirSync as jest.Mock).mockClear();
        (process.cwd as jest.Mock).mockClear();
        jest.clearAllMocks();
    });

    it('returns max/3 files from start, middle, and end with ellipsis', () => {
        const mockFiles = ['1.ts', '2.ts', '3.ts', '4.ts', '5.ts', '6.ts', '7.ts', '8.ts', '9.ts', '10.ts',
                          '11.ts', '12.ts', '13.ts', '14.ts', '15.ts', '16.ts', '17.ts', '18.ts', '19.ts', '20.ts'];
        (readdirSync as jest.Mock).mockReturnValue(mockFiles);
        (process.cwd as jest.Mock).mockReturnValue(mockCwd);
        
        expect(getFilesInCurrentDirectory(9)).toEqual([
            '1.ts', '2.ts', '3.ts',
            '...',
            '10.ts', '11.ts', '12.ts',
            '...',
            '18.ts', '19.ts', '20.ts'
        ]);

        // Verify process.cwd was called
        expect(process.cwd).toHaveBeenCalled();
        expect(readdirSync).toHaveBeenCalledWith(mockCwd);
    });
});

describe('getEnvironmentInfo', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup mock return values to match GitHub Actions environment
        (os.homedir as jest.Mock).mockReturnValue(mockHomedir);
        (os.platform as jest.Mock).mockReturnValue('linux');
        (os.release as jest.Mock).mockReturnValue('6.8.0-1021-azure');
        (os.arch as jest.Mock).mockReturnValue('x64');
        (os.cpus as jest.Mock).mockReturnValue(Array(4).fill({})); // 4 CPUs
        (os.totalmem as jest.Mock).mockReturnValue(17179869184); // 16GB
        (os.freemem as jest.Mock).mockReturnValue(15032385536); // 14GB
        (os.userInfo as jest.Mock).mockReturnValue({ username: 'runner' });
        (readdirSync as jest.Mock).mockReturnValue([
            '.changeset', '.cursor', '.eslintrc.json', '.git', '.gitattributes', 
            '.github', '.gitignore', '.husky', '.npmrc', '.nvmrc', '.prettierignore', 
            '.prettierrc.json', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'README.md', 
            'docs', 'esbuild.js', 'jest.config.cjs', 'node_modules', 'package-lock.json', 
            'package.json', 'src', 'tsconfig.cjs.json', 'tsconfig.esm.json', 'tsconfig.json'
        ]);
    });

    it('returns consistent environment information', () => {
        const info = getEnvironmentInfo();
        expect(info).toMatchSnapshot();
    });
}); 