import { Thread } from '../thread';
import fs from 'fs';
import path from 'path';

describe('Thread', () => {
  let thread: Thread;

  beforeEach(() => {
    thread = new Thread();
  });

  test('should add and retrieve messages', () => {
    thread.addMessage('user', 'Hello');
    thread.addMessage('assistant', 'Hi there!');
    const messages = thread.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi there!');
  });

  test('should clear messages', () => {
    thread.addMessage('user', 'Hello');
    thread.clearMessages();
    expect(thread.getMessages().length).toBe(0);
  });

  test('should add and manage contexts', () => {
    thread.addContext('testKey', { foo: 'bar' });
    expect(thread.hasContext('testKey')).toBeTruthy();
    const context = thread.getContext('testKey');
    expect(context).toBeDefined();
    if (context) {
      expect(context.value).toEqual({ foo: 'bar' });
    }
    let contexts = thread.getAllContexts();
    expect(contexts.get('testKey')).toBeDefined();
    thread.removeContext('testKey');
    expect(thread.hasContext('testKey')).toBeFalsy();
    // Add another context and then clear all
    thread.addContext('anotherKey', 123);
    thread.clearContexts();
    contexts = thread.getAllContexts();
    expect(contexts.size).toBe(0);
  });

  test('should add file context', () => {
    const fileContent = Buffer.from('file content');
    thread.addFileContext({
      key: 'file1',
      content: fileContent,
      filename: 'example.txt',
      mimeType: 'text/plain'
    });
    const context = thread.getContext('file1');
    expect(context).toBeDefined();
    if (context) {
      // Assuming file contexts store their value as an object with content, filename, and mimeType
      expect(context.value).toEqual({ content: fileContent, filename: 'example.txt', mimeType: 'text/plain' });
    }
  });

  test('should clone thread', () => {
    thread.addMessage('user', 'Hello');
    thread.addContext('key1', 'value1');
    const clonedThread = thread.clone();

    // Verify that messages and contexts are the same initially
    expect(clonedThread.getMessages()).toEqual(thread.getMessages());
    expect(Array.from(clonedThread.getAllContexts().entries())).toEqual(Array.from(thread.getAllContexts().entries()));

    // Modify the clone and ensure the original is not affected (deep copy check)
    clonedThread.addMessage('assistant', 'Hi');
    expect(thread.getMessages().length).toBe(1);
    
    // Similarly, change context in clone and original should remain unchanged
    clonedThread.addContext('newKey', 'newValue');
    expect(thread.hasContext('newKey')).toBeFalsy();
  });

  test('should merge threads', () => {
    thread.addMessage('user', 'Hello');
    thread.addContext('key1', 'value1');

    const anotherThread = new Thread();
    anotherThread.addMessage('assistant', 'Hi');
    anotherThread.addContext('key2', 'value2');

    thread.merge(anotherThread);
    const messages = thread.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].content).toBe('Hi');
    expect(thread.hasContext('key1')).toBeTruthy();
    expect(thread.hasContext('key2')).toBeTruthy();
  });

  test('should serialize to JSON', () => {
    thread.addMessage('user', 'Hello JSON');
    thread.addContext('jsonKey', { number: 42 });
    const json = thread.toJSON();
    expect(json.messages.length).toBeGreaterThan(0);
    expect(json.contexts).toBeDefined();
  });

  test('should persist and load thread state', async () => {
    const tempPath = path.join(__dirname, 'temp-thread.json');
    thread.addMessage('user', 'Persist me');
    thread.addContext('persistKey', { data: 'persisted' });
    await thread.save(tempPath);
    const loadedThread = await Thread.load(tempPath);
    expect(loadedThread.getMessages()).toEqual(thread.getMessages());
    expect(Array.from(loadedThread.getAllContexts().entries())).toEqual(Array.from(thread.getAllContexts().entries()));
    // Clean up temp file
    fs.unlinkSync(tempPath);
  });
}); 