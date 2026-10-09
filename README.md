# Named-exports rewrite breaks a pre-resolved remote specifier

`@module-federation/vite` rewrites static imports of a remote specifier
(`import { Thing } from 'widget/Thing'`) into
`import { __moduleExports as …, __mf_remote_pending as … } from 'widget/Thing'`.
It decides this by matching the specifier string against the configured remote
names only. It never checks what the specifier resolves to. When another plugin
with `enforce: 'pre'`, placed before `federation()`, resolves that specifier to
a local module (for example a stub for a remote that is not rendered on the
server), the local module has neither export and the build fails with
`MISSING_EXPORT`.

## Versions

- vite 7.3.7 (rollup 4.64.3)
- @module-federation/vite 1.23.3 (same code in 1.23.1)
- node 24.4.1

## Steps

```sh
npm install && npm run build:ssr
```

- `src/server.ts` imports `{ Thing }` from `widget/Thing`.
- `stub-remotes` in `vite.config.ts` resolves `widget/Thing` to
  `src/stubs/widget-thing.ts`, which exports `Thing`.

## Expected

The build succeeds. `widget/Thing` resolved to a local file, so it is not a
federated remote import and should be left alone.

## Actual

```
vite v7.3.7 building ssr environment for production...
transforming...
✓ 2 modules transformed.
✗ Build failed in 19ms
error during build:
src/server.ts (1:0): "__moduleExports" is not exported by "src/stubs/widget-thing.ts", imported by "src/server.ts".
file: <repo>/src/server.ts:1:0

1: import { Thing } from 'widget/Thing';
   ^
```

The error code is `MISSING_EXPORT`. Rollup stops at the first one; in a project
with many such imports, each one fails the build in turn.

## Controls

| Build | Result |
| --- | --- |
| `NO_STUB=1 npm run build:ssr` (no stub plugin) | succeeds |
| `npm run build:client` (stub plugin, client build) | fails with the same error |
| `vite build --app` with `environments.ssr` | client environment fails first with the same error |
| `import Thing from 'widget/Thing'` (default only; the stub has a default export) | succeeds: default-only imports are not rewritten |
| `import * as W from 'widget/Thing'` | fails with the same error |
| `await import('widget/Thing')` | succeeds: the dynamic import is wrapped, but the wrapper reads the two exports as properties and falls back |

The failure is not specific to SSR. The plugin has no `apply` or
`applyToEnvironment`, so it runs in every environment, for serve and build.

## Responsible code

`src/plugins/pluginRemoteNamedExports.ts` (bundled into `lib/index.js`), the
plugin `module-federation-remote-named-exports` (`enforce: 'post'`):

- `isRemoteImport` returns true when the specifier starts with `<remoteName>/`,
  or equals `<remoteName>` (unless an installed package of that name is
  imported from `node_modules`), or contains `__loadRemote__`.
- `transform` collects matching imports (`collectFromAST`, with
  `collectFromRegex` as fallback) and `applyRewrites` rewrites them. Static
  imports with named or namespace specifiers, and `export { … } from`, become
  imports of `__moduleExports` and `__mf_remote_pending`.

Neither step looks at the resolved id.

## Suggested fix

Check the resolved id (e.g. via `this.resolve`) before rewriting, or expose an
option to exclude specifiers.
