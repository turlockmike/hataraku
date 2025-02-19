# Types Documentation

## Overview

The `types.ts` module provides essential type definitions for handling asynchronous data streams in TypeScript. It combines the power of both `AsyncIterable` and `ReadableStream` interfaces to provide a flexible and type-safe way to work with streaming data.

## API Reference

### AsyncIterableStream<T>

A type definition that represents an asynchronous stream of data that is both an `AsyncIterable` and a `ReadableStream`.

#### Type Signature

```typescript
type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>
```

#### Type Parameters

- `T`: The type of data elements in the stream

#### Description

`AsyncIterableStream` combines two powerful interfaces:
- `AsyncIterable<T>`: Allows for asynchronous iteration using `for await...of` loops
- `ReadableStream<T>`: Provides stream processing capabilities with built-in flow control

This combination enables both traditional async iteration patterns and modern streaming APIs to be used interchangeably.

## Usage Examples

### Basic Usage

```typescript
import { AsyncIterableStream } from './core/types';

// Creating a function that returns an AsyncIterableStream
async function* generateDataStream(): AsyncIterableStream<string> {
    yield 'Hello';
    yield 'World';
}

// Using with for-await-of loop
async function processStream() {
    const stream = generateDataStream();
    for await (const data of stream) {
        console.log(data);
    }
}

// Using as ReadableStream
async function processAsStream() {
    const stream = generateDataStream();
    const reader = stream.getReader();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(value);
    }
}
```

### Common Use Cases

1. **Data Processing Pipelines**
```typescript
async function* processData<T>(stream: AsyncIterableStream<T>): AsyncIterableStream<T> {
    for await (const chunk of stream) {
        // Process each chunk
        yield transform(chunk);
    }
}
```

2. **API Response Streaming**
```typescript
async function fetchDataStream(): AsyncIterableStream<Data> {
    const response = await fetch('api/data/stream');
    return response.body as AsyncIterableStream<Data>;
}
```

## Important Notes

1. The type combines both `AsyncIterable` and `ReadableStream` interfaces, providing maximum flexibility for different streaming scenarios.
2. When implementing this type, ensure your stream implementation satisfies both interface requirements.
3. This type is particularly useful when working with modern Web APIs that use streams while maintaining compatibility with async iteration patterns.

## Best Practices

1. Always properly close or release resources when done with the stream
2. Handle backpressure appropriately when implementing custom streams
3. Consider using error boundaries when working with streams in React or similar frameworks
4. Implement proper error handling in async iterations

## Related Concepts

- JavaScript Iterators and Generators
- Web Streams API
- Async/Await patterns
- TypeScript Generics