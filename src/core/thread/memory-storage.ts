import { Thread, ThreadState } from './thread';
import { ThreadStorage } from './thread';



export class MemoryThreadStorage implements ThreadStorage {
  private threads = new Map<string, ThreadState>();

  constructor() {}

  async save(state: ThreadState): Promise<void> {
    this.threads.set(state.id, state);
  }

  create(threadId?: string): Thread {
    return new Thread({ storage: this, id: threadId });
  }

  load(threadId: string): Thread {
    const state = this.threads.get(threadId);
    if (!state) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    return new Thread({ 
      storage: this,
      state 
    });
  }

  delete(threadId: string): boolean {
    return this.threads.delete(threadId);
  }

  clear(): void {
    this.threads.clear();
  }

  list(): string[] {
    return Array.from(this.threads.keys());
  }
}
