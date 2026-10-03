# Toolchain baseline

Verified on 2026-10-03 through installed tools, official framework documentation and package registries.

| Tool         | Selected | Rationale                                                    |
| ------------ | -------- | ------------------------------------------------------------ |
| Node.js      | 22.23.2  | satisfies Next 16 and Nest 12/Vite 8 Node requirements       |
| pnpm         | 10.34.3  | installed stable workspace manager                           |
| TypeScript   | 5.9.3    | stable version within `typescript-eslint` `<6.1` peer range  |
| Next.js      | 16.3.8   | current registry stable; App Router                          |
| React        | 19.3.0   | current version accepted by Next peer range                  |
| Vite         | 8.3.2    | current registry stable; Node 22.12+ supported               |
| NestJS       | 12.1.2   | current major; all Nest core packages aligned to 12          |
| Tailwind CSS | 4.3.3    | CSS-first config; PostCSS for Next and Vite plugin for admin |
| FastAPI      | 0.142.2  | current PyPI release at selection time                       |

Primary references:

- https://nextjs.org/docs/app/getting-started/installation
- https://docs.nestjs.com/migration-guide
- https://vite.dev/guide/
- https://tailwindcss.com/docs/installation/framework-guides

Versions are exact in manifests/lockfiles. Upgrade work is a reviewed change with the same quality gates.
