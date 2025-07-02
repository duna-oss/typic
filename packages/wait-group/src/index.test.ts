import {WaitGroup} from './index.js';

/**
 * @group deltic
 * @group excluded
 */
describe('WaitGroup', () => {
    test('waiting on no tasks', async () => {
        const wg = new WaitGroup();
        let resolved = false;

        await wg.wait().then(() => resolved = true);

        expect(resolved).toBe(true);
    });

    test('waiting on one task', async () => {
        let resolved = false;
        const wg = new WaitGroup();
        wg.add();

        setTimeout(() => wg.done(), 10);
        await wg.wait().then(() => resolved = true);

        expect(resolved).toBe(true);
    });

    test('waiting on multiple tasks', async () => {
        let resolved = false;
        const wg = new WaitGroup();
        wg.add(2);

        setTimeout(() => wg.done(), 10);
        setTimeout(() => wg.done(), 20);
        await wg.wait().then(() => resolved = true);

        expect(resolved).toBe(true);
    });

    test('cannot be done when not adding', async () => {
        const wg = new WaitGroup();
        await expect(() => wg.done()).toThrow();
    });

    test('the promise is rejected when not done before the timeout', async () => {
        let firstRejected = false;
        let secondRejected = false;
        let firstResolved = false;
        let secondResolved = false;
        const wg = new WaitGroup();
        wg.add(1);

        setTimeout(() => wg.done(), 40);
        await wg.wait(0)
            .then(() => firstResolved = true)
            .catch(() => firstRejected = true);

        await wg.wait(50)
            .then(() => secondResolved = true)
            .catch(() => secondRejected = true);

        expect(firstRejected).toBe(true);
        expect(firstResolved).toBe(false);
        expect(secondRejected).toBe(false);
        expect(secondResolved).toBe(true);

    });
});
