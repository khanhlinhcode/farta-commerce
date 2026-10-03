# Target folder tree

```text
Farta_ecommerce/
├── apps/
│   ├── storefront/              # Next.js App Router
│   ├── admin/                   # Vite + React
│   ├── api/                     # NestJS commerce API
│   └── ai-service/              # FastAPI scaffold; no DB access
├── packages/
│   ├── ui/                      # React primitives only
│   ├── design-tokens/           # framework-neutral semantic tokens
│   ├── types/                   # API contracts; never Mongoose models
│   ├── config/                  # shared non-secret configuration
│   └── eslint-config/           # shared lint policy
├── docs/
│   ├── phase-0/
│   ├── architecture/
│   ├── ba/
│   ├── security/
│   ├── database/
│   ├── api/
│   ├── testing/
│   └── adr/
├── infrastructure/docker/
├── scripts/
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .env.example
├── .editorconfig
├── .gitignore
└── README.md
```

Application packages may depend on shared packages. Shared packages must not depend on applications. Frontends may depend on API contract types, but never on database schemas or server-only configuration.
