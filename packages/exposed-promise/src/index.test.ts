import {exposedPromise} from './index.js';

describe('exposed-promise', () => {
    test('resolving', async () => {
        const exposed = exposedPromise<any>();
        expect(exposed.status).toEqual('pending');
        let resolved = false;
        exposed.resolve(true);
        await exposed.promise.then((r) => resolved = r);
        expect(resolved).toBe(true);
        expect(exposed.status).toEqual('fulfilled');
    });

    test('resolving after rejecting it', async () => {
        const exposed = exposedPromise<any>();
        expect(exposed.status).toEqual('pending');
        exposed.reject();
        exposed.resolve('weird');
        const result = await Promise.allSettled([exposed.promise]);
        expect(result[0].status).toEqual('rejected');
        expect(exposed.status).toEqual('rejected');
    });
});
