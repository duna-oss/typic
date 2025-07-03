export interface BackOffStrategy {
    // Returns the delay to use for the next try, or undefined if max tries has been exceeded
    backOff(attempt: number): number;
}

export class MaxAttemptsExceeded extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly context: {attempt: number},
        cause: unknown = undefined,
    ) {
        const options = cause === undefined ? undefined : {cause};
        super(message, options);
    }

    static atAttempt = (attempt: number) => new MaxAttemptsExceeded(
        'Max attempts exceeded',
        'backoff_strategy.error.max_attempts_exceeded',
        {attempt},
    );
}
