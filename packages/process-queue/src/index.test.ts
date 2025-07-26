import {
    ConcurrentProcessQueue,
    PartitionedProcessQueue,
    type ProcessQueue,
    type ProcessQueueOptions,
    SequentialProcessQueue,
} from './index.js';

type Factory = <T>(options: ProcessQueueOptions<T>) => ProcessQueue<T>;

const createSequentialProcessor = <T>(options: ProcessQueueOptions<T>): ProcessQueue<T> =>
    new SequentialProcessQueue<T>(options);

const createConcurrentProcessor = <T>(options: ProcessQueueOptions<T>): ProcessQueue<T> =>
    new ConcurrentProcessQueue<T>(options);

const createPartitionedProcessor = <T>(options: ProcessQueueOptions<T>): ProcessQueue<T> =>
    new PartitionedProcessQueue<T>(() => new SequentialProcessQueue<T>(options), () => 0, 1);

/**
 * @group deltic
 * @group excluded
 */
describe.each([
    ['sequential', createSequentialProcessor],
    ['concurrent', createConcurrentProcessor],
    ['partitioned', createPartitionedProcessor],
])('@deltic/process-queue %s', (_type: string, factory: Factory) => {
    test('pushing a task on the queue returns a promise that resolves the task when completed', async () => {
        const processor = new AppendingProcessor();
        const processQueue = factory({
            onError: async () => {
                throw new Error('No error handler defined');
            },
            processor: processor.process,
        });
        const task = await processQueue.push('a');
        expect(task).toEqual('a');
        await processQueue.stop();
    });

    test('it supports not auto starting', async () => {
        const processor = new AppendingProcessor();
        const processQueue = factory({
            autoStart: false,
            onError: async () => {
                throw new Error('No error handler defined');
            },
            processor: processor.process,
        });
        processQueue.push('a');
        processQueue.push('b');
        processQueue.push('c');
        await wait(25);
        expect(processor.value).toEqual('');
        await processQueue.stop();
    });

    test('it can be started manually', async () => {
        const processor = new AppendingProcessor();
        const processQueue = factory({
            autoStart: false,
            onError: async () => {
                throw new Error('No error handler defined');
            },
            processor: processor.process,
        });
        processQueue.start();
        processQueue.push('a');
        processQueue.push('b');
        processQueue.push('c');
        processQueue.start();
        await wait(25);
        expect(processor.value).toContain('a');
        expect(processor.value).toContain('b');
        expect(processor.value).toContain('c');
    });

    test('it calls an onError hook that receives thrown errors', async () => {
        let errors = 0;
        const processQueue = factory({
            onError: async () => {
                errors = 1;
            },
            processor: async () => {
                throw new Error('no!');
            },
        });
        processQueue.push('a').catch(() => {
        });
        await wait(5);
        await processQueue.stop();
        expect(errors).toEqual(1);
    });

    test('it calls an onError hook when a promise is rejected', async () => {
        let errors = 0;
        const processQueue = factory({
            onError: async ({queue}) => {
                errors++;
                await queue.stop();
            },
            processor: () => new Promise((_resolve, reject) => reject(new Error('reason'))),
        });
        processQueue.push('a').catch(() => {
        });
        await wait(25);
        expect(errors).toEqual(1);
    });

    test('when an error happens, the task is retried', async () => {
        let tries = 0;
        const processQueue = factory({
            onError: async ({queue, tries}) => {
                if (tries > 5) {
                    await queue.stop();
                }
            },
            processor: async () => {
                tries++;
                throw new Error('failing');
            },
        });
        processQueue.push('a').catch(() => {
        });
        await wait(25);
        await processQueue.stop();
        expect(tries).toEqual(6);
    });

    test('a task can be skipped on error', async () => {
        let tries = 0;
        const processQueue = factory({
            onError: async ({skipCurrentTask}) => {
                skipCurrentTask();
            },
            processor: async () => {
                tries++;
                throw new Error('failing');
            },
        });
        processQueue.push('a');
        processQueue.push('b');
        await wait(25);
        await processQueue.stop();
        expect(tries).toEqual(2);
    });

    test('skipping on error rejects the promise', async () => {
        const processQueue = factory({
            onError: async ({skipCurrentTask}) => {
                skipCurrentTask();
            },
            processor: async () => {
                throw new Error('failing');
            },
        });

        await expect(processQueue.push('a')).rejects.toEqual(new Error('failing'));
        await processQueue.stop();
    });

    test('stopping the queue in the same event loop cycle prevents tasks from being processed', async () => {
        let processed = 0;
        const processQueue = factory({
            onError: async ({skipCurrentTask}) => {
                skipCurrentTask();
            },
            processor: async () => {
                processed++;
            },
        });
        processQueue.push('a');
        processQueue.push('b');
        await processQueue.stop();
        expect(processed).toEqual(0);
    });

    test('purging prevents the next task(s) from being handled', async () => {
        let tries = 0;
        const processQueue = factory({
            onError: async () => {
            },
            processor: async () => {
                tries++;
            },
        });
        processQueue.push('a');
        processQueue.push('b');
        await processQueue.purge();
        expect(tries).toEqual(0);
    });

    test('when a job is completed the onFinish hook is called', async () => {
        let called = false;
        const processQueue = factory({
            onError: async () => {
            },
            onFinish: async () => {
                called = true;
            },
            processor: async () => {
            },
        });
        processQueue.push('something');
        await wait(5);
        await processQueue.stop();
        expect(called).toBe(true);
    });

    test('when a job errors the onFinish hook is NOT called', async () => {
        let called = false;
        const processQueue = factory({
            onError: async ({skipCurrentTask}) => {
                skipCurrentTask();
            },
            onFinish: async () => {
                called = true;
            },
            processor: async () => {
                throw new Error('oh no');
            },
        });
        processQueue.push('something');
        await wait(2);
        await processQueue.stop();
        expect(called).toBe(false);
    });
});

/**
 * @group deltic
 * @group excluded
 */
describe('@deltic/process-queue SequentialProcessQueue', () => {
    test('stopping the queue waits on the current job in progress', async () => {
        let tries = 0;
        const processQueue = new SequentialProcessQueue({
            onError: async ({skipCurrentTask}) => {
                skipCurrentTask();
            },
            processor: async () => {
                tries++;
                await wait(100);
            },
        });
        processQueue.push('a');
        processQueue.push('b');
        await wait(10);
        await processQueue.stop();
        expect(tries).toEqual(1);
    });

    test('the queue processes items in order', async () => {
        const processor = new AppendingProcessor();
        const processQueue = new SequentialProcessQueue({
            onError: async () => {
                throw new Error('No error handler defined');
            },
            processor: processor.process,
        });
        processQueue.push('a');
        processQueue.push('b');
        processQueue.push('c');
        await wait(25);
        expect(processor.value).toEqual('abc');
        await processQueue.stop();
    });
});

/**
 * @group deltic
 * @group excluded
 */
describe('@deltic/process-queue ConcurrentProcessQueue', () => {
    test('the queue processes items in order', async () => {
        const processor = new WaitingProcessor();
        const processQueue = new ConcurrentProcessQueue({
            maxProcessing: 100,
            onError: async () => {
                throw new Error('No error handler defined');
            },
            processor: processor.process,
        });
        processQueue.push(25);
        processQueue.push(15);
        processQueue.push(5);
        await wait(100);
        expect(processor.values).toEqual([5, 15, 25]);
        expect(processor.values[0]).toEqual(5);
        expect(processor.values[1]).toEqual(15);
        expect(processor.values[2]).toEqual(25);
        await processQueue.stop();
    });

    test('stopping the queue waits for all tasks in progress', async () => {
        const processor = new WaitingProcessor();
        const processQueue = new ConcurrentProcessQueue({
            maxProcessing: 100,
            onError: async () => {
                throw new Error('No error handler defined');
            },
            processor: processor.process,
        });
        processQueue.push(45);
        processQueue.push(55);
        processQueue.push(35);
        await wait(20);
        await processQueue.stop();
        expect(processor.values).toEqual([35, 45, 55]);
    });
});

class WaitingProcessor {
    public values: number[] = [];

    constructor() {
        this.process = this.process.bind(this);
    }

    public async process(value: number): Promise<void> {
        await wait(value);
        this.values.push(value);
    }
}

const wait = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

class AppendingProcessor {
    public value: string = '';

    constructor() {
        this.process = this.process.bind(this);
    }

    public async process(value: string): Promise<void> {
        this.value = this.value.concat(value);
    }
}
