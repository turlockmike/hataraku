import { Thread } from '../core/thread/thread';

/**
 * Processes a model response stream and extracts content between <result> tags.
 * Yields partial outputs and returns the final complete response.
 * 
 * @param stream - The model response stream to process
 * @param thread - The thread to add the final response to
 * @returns AsyncGenerator yielding partial responses, with final response as return value
 * @throws {Error} If no attempt_completion with result tag is found
 */
export async function* processResponseStream(
  stream: AsyncIterable<{ type: string, text?: string }>,
  thread: Thread
): AsyncGenerator<string, string, void> {
  let buffer = '';
  let completeResponse = '';
  let inResultMode = false;
  let tagBuffer = '';

  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) {
      for (const char of chunk.text) {
        if (!inResultMode) {
          buffer += char;
          // Look for <attempt_completion> ... <result>
          const attemptIndex = buffer.indexOf('<attempt_completion>');
          if (attemptIndex !== -1) {
            const resultIndex = buffer.indexOf('<result>', attemptIndex);
            if (resultIndex !== -1) {
              // Clear buffer since we're starting fresh
              buffer = '';
              inResultMode = true;
            }
          }
          continue; // Don't yield until we enter result mode
        }
        
        // In result mode, yield partial responses while watching for closing tag
        if (char === '<') {
          if (buffer.length > 0) {
            yield buffer;
            completeResponse += buffer;
            buffer = '';
          }
          tagBuffer = char;
        } else if (tagBuffer.length > 0) {
          tagBuffer += char;
          
          // Check for complete closing tag
          if (tagBuffer === '</result>') {
            const finalResponse = completeResponse.trim();
            thread.addMessage('assistant', finalResponse);
            return finalResponse;
          }
          
          // If we can confirm this isn't the closing tag
          if (!('</result>'.startsWith(tagBuffer))) {
            buffer += tagBuffer;
            tagBuffer = '';
          }
        } else {
          buffer += char;
          if (buffer.length >= 4) {
            yield buffer;
            completeResponse += buffer;
            buffer = '';
          }
        }
      }
    }
  }

  // End of stream
  if (!inResultMode) {
    throw new Error('No attempt_completion with result tag found in response');
  }
  
  // Handle any remaining buffer content
  if (buffer.length > 0) {
    completeResponse += buffer;
  }
  
  const finalResponse = completeResponse.trim();
  thread.addMessage('assistant', finalResponse);
  return finalResponse;
} 