export type LockOptions = {
    timeout?: number;
    abortSignal?: AbortSignal,
}

/**
 * @internal
 */
export function resolveOptions(options: LockOptions): LockOptions {
    let abortSignal: AbortSignal | undefined = options.abortSignal;

    if (options.timeout) {
        abortSignal = options.abortSignal
            ? AbortSignal.any([
                options.abortSignal,
                AbortSignal.timeout(options.timeout),
            ])
            : AbortSignal.timeout(options.timeout);
    }

    maybeAbort(abortSignal);

    return {...options, abortSignal};
}

/**
 * @internal
 */
export function maybeAbort(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw signal.reason;
    }
}