import {defineConfig} from 'tsdown';
import {resolve} from 'path';
import {readdir, readFile} from 'fs/promises';

const packageDirectories: string[] = Array.from(
    (await readdir(resolve(import.meta.dirname, 'packages'), {withFileTypes: true}))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
);

const aliases: Record<string, string> = {};


await Promise.all(packageDirectories.map(async name => {
    const packageFile = JSON.parse(await readFile(resolve(import.meta.dirname, 'packages', name, 'package.json'), 'utf8'));
    const exportDeclarations = packageFile['exports'] ?? {};

    for (const key in exportDeclarations) {
        const destination = resolve(import.meta.dirname, 'packages', name, exportDeclarations[key]['import'].replace('dist', 'src').replace('.js', '.ts'));

        if (key === '.') {
            aliases[`@typic/${name}`] = destination;
        } else if (key.startsWith('./')) {
            aliases[`@typic/${name}/${key.substring(2)}`] = destination;
        }
    }

}));

export default [
    ...packageDirectories.map(dirname => {
        return defineConfig({
            sourcemap: true,
            dts: true,
            external: [/^@typic\//],
            alias: aliases,
            skipNodeModulesBundle: true,
            entry: [`packages/${dirname}/src/index.ts`],
            outDir: resolve(import.meta.dirname, `packages/${dirname}/dist`),
            platform: 'node',
            unbundle: true,
        });
    }),
];