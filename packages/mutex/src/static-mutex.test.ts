import {
    type StaticMutex,
    UnableToAcquireLock,
    UnableToReleaseLock,
} from './index.js';
import {StaticMutexUsingMemory} from './static-memory-mutex.js';

let mutex: StaticMutex;

describe.each([
    ['Memory', () => new StaticMutexUsingMemory()],
])('Mutex using %s', (_name, factory) => {
    beforeEach(() => {
        mutex = factory();
    });

    test('a lock can be acquired and released', async () => {
        expect.assertions(0);
        await mutex.lock({timeout: 100});
        await mutex.unlock();
    });

    test('a tried lock can be acquired and released', async () => {
        const locked = await mutex.tryLock({timeout: 100});
        await mutex.unlock();

        // assert
        expect(locked).toEqual(true);
    });

    test('a lock cannot be acquired twice', async () => {
        // arrange
        await mutex.lock({timeout: 100});

        // act
        await expect(async () => {
            await mutex.lock({timeout: 1});
        }).rejects.toThrow(UnableToAcquireLock);

        // cleanup
        await mutex.unlock();
    });

    test('a locked mutex can try but will not acquire a lock', async () => {
        // arrange
        await mutex.lock({timeout: 100});

        // act
        const locked = await mutex.tryLock({timeout: 100});


        // assert
        expect(locked).toBe(false);

        // cleanup
        await mutex.unlock();
    });

    test('released locks can be acquired again', async () => {
        await mutex.lock({timeout: 100});

        expect(await mutex.tryLock({timeout: 100})).toEqual(false);

        await mutex.unlock();

        expect(await mutex.tryLock({timeout: 100})).toEqual(true);

        // cleanup
        await mutex.unlock();
    });

    test('locks that are not acquired cannot be released', async () => {
        await expect(async () => {
            await mutex.unlock();
        }).rejects.toThrow(new UnableToReleaseLock());
    });
});
