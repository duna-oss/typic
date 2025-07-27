import type {Pool, PoolClient} from 'pg';
import {StaticMutexUsingMemory} from '@deltic/mutex/static-memory-mutex';
import {AsyncLocalStorage} from 'node:async_hooks';
import {StaticMutex} from '@deltic/mutex';

export type Connection = PoolClient | Pool;

/**
 * Connection providers facilitate the sharing of transactions between infrastructural layers. The
 * primary benefit is that it makes code more composable, without making your domain APIs database
 * aware. This is achieved by (optionally) storing a connection, and using it as the connection for
 * interactions that are coupled through composition. Doing so makes infrastructural coupling work
 * with and without a database transaction.
 */
export interface PgConnectionProvider {
    primaryConnection(): Connection;
    secondaryConnection(): Connection;
    claim(): Promise<PoolClient>;
    release(client: PoolClient): void;
    begin(query?: string): Promise<PoolClient>;
    commit(client: PoolClient): Promise<void>;
    rollback(client: PoolClient): Promise<void>;
}

export interface PgTransactionContext {
    exclusiveAccess: StaticMutex,
    sharedTransaction?: Connection | undefined,
}

export interface PgTransactionContextProvider {
    resolve(): PgTransactionContext;
}

export class StaticPgTransactionContextProvider implements PgTransactionContextProvider {
    private exclusiveAccess = new StaticMutexUsingMemory();
    private sharedTransaction: PoolClient | undefined;

    resolve(): PgTransactionContext {
        return {
            exclusiveAccess: this.exclusiveAccess,
            sharedTransaction: this.sharedTransaction,
        };
    }
}

export class AsyncPgTransactionContextProvider implements PgTransactionContextProvider {
    constructor(
        private readonly store: AsyncLocalStorage<PgTransactionContext> = new AsyncLocalStorage<PgTransactionContext>(),
    ) {
    }

    resolve(): PgTransactionContext {
        const context = this.store.getStore();

        if (!context) {
            throw new Error('No transaction context set, did you forget a .run call?');
        }

        return context;
    }

    run<R>(callback: () => R): R {
        return this.store.run({
            exclusiveAccess: new StaticMutexUsingMemory(),
            sharedTransaction: undefined,
        }, callback);
    }
}

export class PgConnectionProviderWithPool implements PgConnectionProvider {
    constructor(
        private readonly pool: Pool,
        private readonly options: {
            shareTransactions: boolean,
        } = {
            shareTransactions: true,
        },
        private readonly context: PgTransactionContextProvider =  new StaticPgTransactionContextProvider(),
    ) {
    }

    async claim(): Promise<PoolClient> {
        return this.pool.connect();
    }

    async begin(query?: string): Promise<PoolClient> {
        if (!this.options.shareTransactions) {
            const client = await this.claim();

            try {
                await client.query(query ?? 'BEGIN');

                return client;
            } catch (e) {
                this.release(client);

                throw e;
            }
        }

        const context = this.context.resolve();
        await context.exclusiveAccess.lock();

        try {
            const client = await this.claim();

            await client.query(query ?? 'BEGIN');

            if (this.options.shareTransactions) {
                context.sharedTransaction = client;
            }

            return client;
        } finally {
            context.exclusiveAccess.unlock();
        }
    }

    async commit(client: PoolClient): Promise<void> {
        try {
            await client.query('COMMIT');
        } finally {
            this.release(client);
            this.context.resolve().sharedTransaction = undefined;
        }
    }

    async rollback(client: PoolClient): Promise<void> {
        try {
            await client.query('ROLLBACK');
        } finally {
            this.release(client);
            this.context.resolve().sharedTransaction = undefined;
        }
    }

    primaryConnection(): Connection {
        return this.context.resolve().sharedTransaction ?? this.pool;
    }

    secondaryConnection(): Connection {
        return this.pool;
    }

    release(client: PoolClient): void {
        client.release();
    }
}

