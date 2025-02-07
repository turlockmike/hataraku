import { ApiStreamChunk, ApiStreamTextChunk } from '../api/transform/stream';

/**
 * Transforms an ApiStreamChunk stream into a format suitable for XMLStreamParser.
 * Filters out non-text chunks and extracts text content from text chunks.
 * 
 * @param stream - The ApiStreamChunk stream to transform
 * @returns AsyncGenerator that yields text content from the stream
 */
export async function* transformApiStreamForXmlParser(
  stream: AsyncIterable<ApiStreamChunk>
): AsyncGenerator<string, void, unknown> {
  for await (const chunk of stream) {
    if (chunk.type === 'text') {
      const textChunk = chunk as ApiStreamTextChunk;
      if (textChunk.text) {
        yield textChunk.text;
      }
    }
    // Ignore other chunk types (usage, etc) as they're not needed for XML parsing
  }
}