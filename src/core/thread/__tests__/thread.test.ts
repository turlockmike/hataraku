import { Thread } from '../thread';
import fs from 'fs';
import path from 'path';
import { MemoryThreadStorage } from '../memory-storage';

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
    const storage = {
      save: jest.fn(),
    }
    const thread = new Thread({ storage });
    
    // Add some test data
    thread.addMessage('user', 'Persist me');
    thread.addContext('persistKey', { data: 'persisted' });
    await thread.save();
    expect(storage.save).toHaveBeenCalledWith(thread.toJSON());
  });

  describe('getFormattedMessages', () => {
    test('should format messages without context', () => {
      thread.addMessage('user', 'Hello');
      thread.addMessage('assistant', 'Hi there!');
      
      const formatted = thread.getFormattedMessages(false);
      expect(formatted).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]);
    });

    test('should format messages with context', () => {
      thread.addMessage('user', 'Hello');
      thread.addMessage('assistant', 'Hi there!');
      thread.addContext('testKey', { foo: 'bar' });
      thread.addContext('numberKey', 42);
      
      const formatted = thread.getFormattedMessages(true);
      expect(formatted).toEqual([
        { role: 'user', content: 'Context testKey: {"key":"testKey","value":{"foo":"bar"}}' },
        { role: 'user', content: 'Context numberKey: {"key":"numberKey","value":42}' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]);
    });

    test('should format messages with file context', () => {
      thread.addMessage('user', 'Check this file');
      const fileContent = Buffer.from('test content');
      thread.addFileContext({
        key: 'file1',
        content: fileContent,
        filename: 'test.txt',
        mimeType: 'text/plain'
      });
      
      const formatted = thread.getFormattedMessages(true);
      expect(formatted).toEqual([
        { 
          role: 'user', 
          content: expect.stringContaining('Context file1: {"type":"file","key":"file1","value":{"content":{"type":"Buffer"')
        },
        { role: 'user', content: 'Check this file' }
      ]);
    });

    test('should handle empty thread', () => {
      const formatted = thread.getFormattedMessages(true);
      expect(formatted).toEqual([]);
    });
  });

  describe('truncate', () => {
    test('should truncate thread to respect max total tokens', () => {
      // Add messages that total to more than 100 tokens (400 chars)
      thread.addMessage('user', 'A'.repeat(200));
      thread.addMessage('assistant', 'B'.repeat(300));
      thread.addMessage('user', 'C'.repeat(100));
      
      // Truncate to 100 tokens (400 chars)
      const truncated = thread.truncate(100);
      const messages = truncated.getMessages();
      
      // Should only keep the most recent messages that fit within token limit
      expect(messages.length).toBeLessThan(3);
      expect(messages[messages.length - 1].content).toBe('C'.repeat(100));
    });

    test('should truncate individual messages that exceed maxTokensPerMessage', () => {
      // Add a message that exceeds 10 tokens (40 chars)
      thread.addMessage('user', 'A'.repeat(100));
      
      // Truncate with maxTokensPerMessage = 10
      const truncated = thread.truncate(1000, 10);
      const messages = truncated.getMessages();
      
      // Message should be truncated to 40 characters (10 tokens)
      expect(messages[0].content.length).toBe(40);
      expect(messages[0].content).toBe('A'.repeat(40));
    });

    test('should preserve message order after truncation', () => {
      thread.addMessage('user', 'First');
      thread.addMessage('assistant', 'Second');
      thread.addMessage('user', 'Third');
      
      const truncated = thread.truncate(1000);
      const messages = truncated.getMessages();
      
      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    test('should handle empty thread', () => {
      const truncated = thread.truncate(100);
      expect(truncated.getMessages().length).toBe(0);
    });

    test('should preserve thread metadata and contexts after truncation', () => {
      thread.addMessage('user', 'Test message');
      thread.addContext('testKey', { foo: 'bar' });
      
      const truncated = thread.truncate(100);
      
      expect(truncated.getContext('testKey')).toBeDefined();
      expect(truncated.id).toBe(thread.id);
    });

    test('should use default maxTokensPerMessage when not specified', () => {
      // Add a message that exceeds default 50k tokens (200k chars)
      const longMessage = 'A'.repeat(250000);
      thread.addMessage('user', longMessage);
      
      const truncated = thread.truncate(100000);
      const messages = truncated.getMessages();
      
      // Message should be truncated to 200k characters (50k tokens)
      expect(messages[0].content.length).toBe(200000);
    });

    test('should always preserve the first message after truncation', () => {
      const firstMessage = 'First message that must be preserved';
      thread.addMessage('user', firstMessage);
      thread.addMessage('assistant', 'B'.repeat(300));
      thread.addMessage('user', 'C'.repeat(300));
      
      // Truncate to a small token limit that would normally exclude all but the most recent message
      const truncated = thread.truncate(50);
      const messages = truncated.getMessages();
      
      // First message should always be present
      expect(messages[0].content).toBe(firstMessage);
      expect(messages.length).toBe(2); // First message + most recent that fits
    });

    test('should handle first message exceeding maxTokensPerMessage', () => {
      const longFirstMessage = 'A'.repeat(100);
      thread.addMessage('user', longFirstMessage);
      thread.addMessage('assistant', 'Short message');
      
      // Truncate with small maxTokensPerMessage
      const truncated = thread.truncate(1000, 10); // 10 tokens = 40 chars
      const messages = truncated.getMessages();
      
      // First message should be truncated but present
      expect(messages[0].content.length).toBe(40);
      expect(messages[0].content).toBe('A'.repeat(40));
      expect(messages[1].content).toBe('Short message');
    });

    test('should handle case where first message alone exceeds maxTokens', () => {
      const longFirstMessage = 'A'.repeat(1000); // 250 tokens
      thread.addMessage('user', longFirstMessage);
      thread.addMessage('assistant', 'Second message');
      
      // Truncate to less tokens than the first message
      const truncated = thread.truncate(100); // 100 tokens = 400 chars
      const messages = truncated.getMessages();
      
      // Should still keep truncated first message
      expect(messages.length).toBe(1);
      expect(messages[0].content.length).toBe(400);
    });
  });
}); 