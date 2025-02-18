import { Thread, ThreadState } from './thread';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { ThreadStorage } from './thread';

export class FileSystemStorage implements ThreadStorage {
  private constructor(
    private filePath: string,
  ) {}

  static async create(filePath: string): Promise<Thread> {
    // Check if file exists
    if(existsSync(filePath)) {
      throw new Error(`thread already exists: ${filePath}`);
    }

    return new Thread({ storage: new FileSystemStorage(filePath) });
  }

  static async load(filePath: string): Promise<Thread> {
    const data = await fs.readFile(filePath, 'utf8');
    const state = JSON.parse(data, (key, value) => {
      if (Array.isArray(value) && value.every(item => Array.isArray(item) && item.length === 2)) {
        return new Map(value);
      }
      if (value && typeof value === 'object') {
        if (value.type === 'Buffer') {
          return Buffer.from(value.data, 'base64');
        }
        if (value.type === 'Date') {
          return new Date(value.value);
        }
      }
      return value;
    });

    return new Thread({ 
      storage: new FileSystemStorage(filePath), 
      state 
    });
  }

  async save(state: ThreadState): Promise<void> {
    const dirPath = this.filePath.split('/').slice(0, -1).join('/');
    if (dirPath) {
      await fs.mkdir(dirPath, { recursive: true });
    }

    const serializedState = JSON.stringify(state, (key, value) => {
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      if (value instanceof Buffer) {
        return {
          type: 'Buffer',
          data: value.toString('base64')
        };
      }
      if (value instanceof Date) {
        return {
          type: 'Date',
          value: value.toISOString()
        };
      }
      // Deep traverse objects to find and convert Date objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const converted = { ...value };
        for (const [k, v] of Object.entries(value)) {
          if (v instanceof Date) {
            converted[k] = {
              type: 'Date',
              value: v.toISOString()
            };
          }
        }
        return converted;
      }
      return value;
    });

    await fs.writeFile(this.filePath, serializedState, 'utf8');
  }
} 