import { getFilesInCurrentDirectory } from '../environment';
import { readdirSync } from 'node:fs';

// Mock the fs module
jest.mock('node:fs', () => ({
    readdirSync: jest.fn()
}));

describe('getFilesInCurrentDirectory', () => {
    it('returns max/3 files from start, middle, and end with ellipsis', () => {
        const mockFiles = ['1.ts', '2.ts', '3.ts', '4.ts', '5.ts', '6.ts', '7.ts', '8.ts', '9.ts', '10.ts',
                          '11.ts', '12.ts', '13.ts', '14.ts', '15.ts', '16.ts', '17.ts', '18.ts', '19.ts', '20.ts'];
        (readdirSync as jest.Mock).mockReturnValue(mockFiles);
        
        expect(getFilesInCurrentDirectory(9)).toEqual([
            '1.ts', '2.ts', '3.ts',
            '...',
            '10.ts', '11.ts', '12.ts',
            '...',
            '18.ts', '19.ts', '20.ts'
        ]);
    });
}); 