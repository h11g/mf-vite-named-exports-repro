import { fileURLToPath } from 'node:url';
import { federation } from '@module-federation/vite';
import { defineConfig, type Plugin } from 'vite';

const stub = fileURLToPath(new URL('./src/stubs/widget-thing.ts', import.meta.url));

// Stands in for a remote that is never rendered on the server.
function stubRemotes(): Plugin {
  return {
    name: 'stub-remotes',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'widget/Thing') return stub;
    },
  };
}

export default defineConfig({
  plugins: [
    process.env.NO_STUB ? null : stubRemotes(),
    federation({
      name: 'host',
      remotes: {
        widget: {
          type: 'module',
          name: 'widget',
          entry: 'http://localhost:4174/remoteEntry.js',
        },
      },
      shared: {},
      dts: false,
    }),
  ],
});
