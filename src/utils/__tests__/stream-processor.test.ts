import { processResponseStream, transformApiStreamForXmlParser } from '../stream-processor';
import { Thread } from '../../core/thread/thread';
import { ApiStreamChunk } from '../../api/transform/stream';

// Helper function to create async iterable from chunks
async function* createMockStream(chunks: ApiStreamChunk[]): AsyncIterable<ApiStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('Stream Processor', () => {
  describe('transformApiStreamForXmlParser', () => {
    it('should transform text chunks and ignore usage chunks', async () => {
      const mockChunks: ApiStreamChunk[] = [
        { type: 'text', text: 'Hello' },
        { type: 'usage', inputTokens: 10, outputTokens: 5 },
        { type: 'text', text: ' world' },
        { type: 'text', text: '!' }
      ];

      const stream = createMockStream(mockChunks);
      const transformedStream = transformApiStreamForXmlParser(stream);
      
      const result: string[] = [];
      for await (const chunk of transformedStream) {
        result.push(chunk);
      }

      expect(result).toEqual(['Hello', ' world', '!']);
    });

    it('should handle empty text chunks', async () => {
      const mockChunks: ApiStreamChunk[] = [
        { type: 'text', text: '' },
        { type: 'text', text: 'content' },
        { type: 'text', text: '' }
      ];

      const stream = createMockStream(mockChunks);
      const transformedStream = transformApiStreamForXmlParser(stream);
      
      const result: string[] = [];
      for await (const chunk of transformedStream) {
        result.push(chunk);
      }

      expect(result).toEqual(['content']);
    });

    it('should handle stream with only usage chunks', async () => {
      const mockChunks: ApiStreamChunk[] = [
        { type: 'usage', inputTokens: 10, outputTokens: 5 },
        { type: 'usage', inputTokens: 20, outputTokens: 10 }
      ];

      const stream = createMockStream(mockChunks);
      const transformedStream = transformApiStreamForXmlParser(stream);
      
      const result: string[] = [];
      for await (const chunk of transformedStream) {
        result.push(chunk);
      }

      expect(result).toEqual([]);
    });
  });

  // ... existing tests ...
}); 