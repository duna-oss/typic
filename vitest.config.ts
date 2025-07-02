import {defineConfig} from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import {join} from 'node:path';


export default defineConfig({
    plugins: [tsconfigPaths()],
    resolve: {
        alias: [
            {
                find: /^@typic\/(.*)$/,
                replacement: join(new URL(import.meta.url).pathname, '../packages', '$1', 'src/index.ts'),
            },
        ],
    },
    test: {
        testTimeout: 10_000,
        include: ['packages/*/src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        globals: true,
        clearMocks: false,
        // setupFiles: ['dotenv/config'],

        // profiling
        // pool: 'forks',
        // poolOptions: {
        //     forks: {
        //         execArgv: [
        //             '--cpu-prof',
        //             '--cpu-prof-dir=test-runner-profile',
        //             // '--heap-prof',
        //             // '--heap-prof-dir=test-runner-profile'
        //         ],
        //
        //         // To generate a single profile
        //         singleFork: true,
        //     },
        // },
    },
});