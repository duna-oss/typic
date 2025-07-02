export interface ResolveFunc<T> {
    (t: T | PromiseLike<T>): void,
}

export interface RejectFunc {
    (reason?: any): void
}

export type PromiseStatus = 'pending' | 'fulfilled' | 'rejected';

export type ExposedPromise<T> = { resolve: ResolveFunc<T>, reject: RejectFunc, promise: Promise<T>, status: PromiseStatus }

export function exposedPromise<T = void>(): ExposedPromise<T>
{

    let status: PromiseStatus = 'pending';
    /* istanbul ignore next  */
    let resolve: ResolveFunc<T> = () => {};
    /* istanbul ignore next  */
    let reject: RejectFunc = () => {};
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return {
        resolve: (t: T | PromiseLike<T>) => {
            if (status === 'pending') {
                status = 'fulfilled';
            }
            resolve(t);
        },
        reject: (r?: any) => {
            if (status === 'pending') {
                status = 'rejected';
            }
            reject(r);
        },
        promise,
        get status() { return status; },
    };
}
