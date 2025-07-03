export type ErrorContext = { [index: string]: string | number | null };

// if we can find a way for this not to be an abstract class, that'd be great
export abstract class StandardError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly context: ErrorContext = {},
        cause: unknown = undefined,
    ) {
        const options = cause === undefined ? undefined : {cause};
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore TS2554
        super(message, options);
    }
}

export function errorToMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
