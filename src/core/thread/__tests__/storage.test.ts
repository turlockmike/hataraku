import { MemoryThreadStorage, FileSystemStorage } from '../storage';
import { Thread } from '../thread';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

describe('MemoryStorage', () => {
  let storage: MemoryThreadStorage;

  beforeEach(() => {
    storage = new MemoryThreadStorage();
  });

  test('creates a new thread', () => {
    const thread = storage.create();
    expect(thread).toBeInstanceOf(Thread);
    expect(thread.id).toBeDefined();
  });

  test('creates a thread with specific id', () => {
    const threadId = 'test-thread-id';
    const thread = storage.create(threadId);
    expect(thread.id).toBe(threadId);
  });

  test('saves and loads a thread', async () => {
    const thread = storage.create();
    thread.addMessage('user', 'test message');
    await thread.save();

    const loaded = storage.load(thread.id);
    expect(loaded.getMessages()).toHaveLength(1);
    expect(loaded.getMessages()[0].content).toBe('test message');
  });

  test('throws when loading non-existent thread', () => {
    expect(() => storage.load('non-existent')).toThrow('Thread not found');
  });

  test('deletes a thread', async () => {
    const thread = storage.create();
    await thread.save();
    
    expect(storage.delete(thread.id)).toBe(true);
    expect(() => storage.load(thread.id)).toThrow('Thread not found');
  });

  test('lists all thread ids', async () => {
    const thread1 = storage.create();
    const thread2 = storage.create();
    await thread1.save();
    await thread2.save();

    const ids = storage.list();
    expect(ids).toContain(thread1.id);
    expect(ids).toContain(thread2.id);
  });

  test('clears all threads', async () => {
    const thread1 = storage.create();
    const thread2 = storage.create();
    await thread1.save();
    await thread2.save();

    storage.clear();
    expect(storage.list()).toHaveLength(0);
  });
});

describe('FileSystemStorage', () => {
  const testDir = path.join(__dirname, 'test-threads');
  
  beforeEach(async () => {
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
  });

  test('creates a new thread', async () => {
    const filePath = path.join(testDir, 'thread.json');
    const thread = await FileSystemStorage.create(filePath);
    expect(thread).toBeInstanceOf(Thread);
    expect(thread.id).toBeDefined();
  });

  test('throws when creating thread with existing file', async () => {
    const filePath = path.join(testDir, 'thread.json');
    await fs.writeFile(filePath, '{}');
    
    await expect(FileSystemStorage.create(filePath)).rejects.toThrow('thread already exists');
  });

  test('saves and loads a thread', async () => {
    const filePath = path.join(testDir, 'thread.json');
    const thread = await FileSystemStorage.create(filePath);
    thread.addMessage('user', 'test message');
    await thread.save();

    const loaded = await FileSystemStorage.load(filePath);
    expect(loaded.getMessages()).toHaveLength(1);
    expect(loaded.getMessages()[0].content).toBe('test message');
  });

  test('throws when loading non-existent file', async () => {
    const filePath = path.join(testDir, 'non-existent.json');
    await expect(FileSystemStorage.load(filePath)).rejects.toThrow();
  });

  test('handles complex data types', async () => {
    const filePath = path.join(testDir, 'thread.json');
    const thread = await FileSystemStorage.create(filePath);
    
    // Test Map
    thread.addContext('test', { value: 123 });
    
    // Test Buffer
    thread.addFileContext({
      key: 'file',
      content: Buffer.from('test content'),
      filename: 'test.txt',
      mimeType: 'text/plain'
    });

    await thread.save();

    const loaded = await FileSystemStorage.load(filePath);
    expect(loaded.getContext('test')?.value).toEqual({ value: 123 });
    
    const fileContext = loaded.getContext('file');
    expect(fileContext?.type).toBe('file');
    expect(Buffer.isBuffer(fileContext?.value.content)).toBe(true);
    expect(fileContext?.value.content.toString()).toBe('test content');
  });
}); 