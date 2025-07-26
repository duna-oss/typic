import type {Pool, PoolClient} from 'pg';
import {StaticMutexUsingMemory} from '@deltic/mutex/static-memory-mutex';
// import {AsyncLocalStorage} from 'node:async_hooks';

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

export class PgConnectionProviderWithPool implements PgConnectionProvider {
    private exclusiveAccess = new StaticMutexUsingMemory();
    private sharedTransaction: PoolClient | undefined;

    constructor(
        private readonly pool: Pool,
        private readonly options: {
            shareTransactions?: boolean,
        } = {
            shareTransactions: true,
        },
    ) {
    }

    async claim(): Promise<PoolClient> {
        return this.pool.connect();
    }

    async begin(query?: string): Promise<PoolClient> {
        await this.exclusiveAccess.lock({});
        const client = await this.claim();

        await client.query(query ?? 'BEGIN');

        if (this.options.shareTransactions) {
            this.sharedTransaction = client;
        }

        return client;
    }

    async commit(client: PoolClient): Promise<void> {
        try {
            await client.query('COMMIT');
        } finally {
            this.release(client);
            this.sharedTransaction = undefined;
        }
    }

    async rollback(client: PoolClient): Promise<void> {
        try {
            await client.query('ROLLBACK');
        } finally {
            this.release(client);
            this.sharedTransaction = undefined;
        }
    }

    primaryConnection(): Connection {
        return this.sharedTransaction ?? this.pool;
    }

    secondaryConnection(): Connection {
        return this.pool;
    }

    release(client: PoolClient): void {
        client.release();
    }
}



// export class PGConnectionProviderWithAsyncLocalStorage implements PgConnectionProvider {
//
//     constructor(
//         private readonly pool: PoolClient,
//         private readonly storage: AsyncLocalStorage<{}>
//     ) {
//
//     }
// }

