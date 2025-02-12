import { Tool, ToolExecutionOptions } from 'ai';
import { listFilesTool } from '../list-files';
import * as fs from 'fs/promises';
import { Stats, Dirent } from 'fs';
import * as path from 'path';

// Mock fs and path modules
jest.mock('fs/promises');
jest.mock('path');

describe('listFilesTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: []
  };

  // Cast tool to ensure execute method is available
  const tool = listFilesTool as Required<Tool>;

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;

  // Helper to create mock Dirent
  function createMockDirent(name: string, isDir: boolean): Dirent {
    return {
      name,
      isDirectory: () => isDir,
      isFile: () => !isDir,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      isSymbolicLink: () => false
    } as Dirent;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`);
    mockPath.relative.mockImplementation((_, filePath) => filePath.replace('/mock/path/', ''));
  });

  it('should list files in a directory non-recursively', async () => {
    const mockDirents = [
      createMockDirent('file1.txt', false),
      createMockDirent('file2.js', false),
      createMockDirent('subdir', true)
    ];

    mockFs.readdir.mockResolvedValue(mockDirents);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as Stats);

    const result = await tool.execute({
      path: 'test-dir',
      recursive: false
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('file1.txt\nfile2.js\nsubdir');
    expect(mockFs.readdir).toHaveBeenCalledWith('/mock/path/test-dir', { withFileTypes: true });
  });

  it('should list files recursively', async () => {
    const mockDirents = [
      createMockDirent('file1.txt', false),
      createMockDirent('subdir', true)
    ];

    const mockSubDirents = [
      createMockDirent('subfile1.js', false),
      createMockDirent('subfile2.css', false)
    ];

    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as Stats);
    mockFs.readdir
      .mockResolvedValueOnce(mockDirents)
      .mockResolvedValueOnce(mockSubDirents);

    const result = await tool.execute({
      path: 'test-dir',
      recursive: true
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe(
      'file1.txt\n' +
      'subdir/subfile1.js\n' +
      'subdir/subfile2.css'
    );
  });

  it('should handle empty directories', async () => {
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as Stats);

    const result = await tool.execute({
      path: 'empty-dir'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('(empty directory)');
  });

  it('should handle directory not found', async () => {
    mockFs.stat.mockRejectedValue(new Error('Directory not found'));

    const result = await tool.execute({
      path: 'non-existent-dir'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Directory not found: non-existent-dir');
  });

  it('should handle path that is not a directory', async () => {
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as Stats);

    const result = await tool.execute({
      path: 'file.txt'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Path is not a directory: file.txt');
  });

  it('should handle read directory errors', async () => {
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as Stats);
    mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

    const result = await tool.execute({
      path: 'protected-dir'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error listing files: Permission denied');
  });

  it('should handle deep recursive structures', async () => {
    const mockStructure: Record<string, Dirent[]> = {
      'dir1': [
        createMockDirent('file1.txt', false),
        createMockDirent('subdir1', true)
      ],
      'dir1/subdir1': [
        createMockDirent('file2.js', false),
        createMockDirent('subdir2', true)
      ],
      'dir1/subdir1/subdir2': [
        createMockDirent('file3.css', false)
      ]
    };

    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as Stats);
    mockFs.readdir.mockImplementation((dirPath) => {
      const normalizedDir = String(dirPath).replace('/mock/path/', '');
      return Promise.resolve(mockStructure[normalizedDir] || []);
    });

    const result = await tool.execute({
      path: 'dir1',
      recursive: true
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe(
      'file1.txt\n' +
      'subdir1/file2.js\n' +
      'subdir1/subdir2/file3.css'
    );
  });
});