/**
 * Creates a mock stream that implements both AsyncGenerator and push/end methods
 */
export function createMockStream<T>(): AsyncGenerator<T> & { push(item: T): void; end(): void } {
  const chunks: T[] = [];
  let content: T[] = [];
  let position = 0;
  let finished = false;
  
  return {
    push: (chunk: T) => {
      chunks.push(chunk);
      content.push(chunk);
    },
    end: () => {
      finished = true;
    },
    async next(): Promise<IteratorResult<T>> {
      if (position >= chunks.length) {
        if (finished) {return { value: undefined, done: true };}
        // Wait for more data
        await new Promise(resolve => setTimeout(resolve, 0));
        return this.next();
      }
      return { value: chunks[position++], done: false };
    },
    async return(): Promise<IteratorResult<T>> {
      return { value: content.join('') as any, done: true };
    },
    async throw(): Promise<IteratorResult<T>> {
      return { value: undefined, done: true };
    },
    [Symbol.asyncIterator]() { return this; },
    async [Symbol.asyncDispose]() {}
  };
} 