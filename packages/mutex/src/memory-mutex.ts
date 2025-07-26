import {DynamicMutex, LockOptions, UnableToAcquireLock, UnableToReleaseLock} from './index.js';
import {maybeAbort, resolveOptions} from './abort-signal-options.js';
import {exposedPromise, type ExposedPromise} from '@deltic/exposed-promise';

export class MutexUsingMemory<LockID> implements DynamicMutex<LockID> {
    private readonly locks = new Map<LockID, true>();
    private waiters: ExposedPromise<void>[] = [];

    async lock(id: LockID, options: LockOptions): Promise<void> {
        const opt = resolveOptions(options);

        if (this.tryLockSync(id)) {
            return;
        }

        const waiter = exposedPromise();
        this.waiters.push(waiter);
        opt.abortSignal?.addEventListener('abort', (err) => {
            waiter.reject(UnableToAcquireLock.becauseOfError(err));
        });

        await waiter.promise;
    }

    private tryLockSync(id: LockID): boolean {
        if (this.locks.get(id)) {
            return false;
        }

        this.locks.set(id, true);

        return true;
    }

    async tryLock(id: LockID, options: LockOptions): Promise<boolean> {
        maybeAbort(options.abortSignal);

        return this.tryLockSync(id);
    }

    async unlock(id: LockID): Promise<void> {
        if (!this.locks.get(id)) {
            throw new UnableToReleaseLock();
        }

        let waiter = this.waiters.shift();

        while(waiter && waiter.status !== 'pending') {
            waiter = this.waiters.shift();
        }

        if (waiter) {
            waiter.resolve();
        } else {
            this.locks.delete(id);
        }
    }
}