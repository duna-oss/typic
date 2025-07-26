import {LockOptions, StaticMutex} from './index.js';
import {MutexUsingMemory} from './memory-mutex.js';

export class StaticMutexUsingMemory implements StaticMutex {
    private readonly mutex = new MutexUsingMemory<true>();

    tryLock(options: LockOptions): Promise<boolean> {
        return this.mutex.tryLock(true, options);
    }

    lock(options: LockOptions): Promise<void> {
        return this.mutex.lock(true, options);
    }

    unlock(): Promise<void> {
        return this.mutex.unlock(true);
    }
}