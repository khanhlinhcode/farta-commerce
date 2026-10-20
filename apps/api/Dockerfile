FROM node:22.23.2-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/types/package.json packages/types/package.json

RUN pnpm --filter @farta/api... install --frozen-lockfile

COPY apps/api apps/api
COPY packages/config packages/config
COPY packages/types packages/types

RUN pnpm --filter @farta/api build
RUN pnpm --config.strict-peer-dependencies=false \
  --filter @farta/api deploy --prod --legacy /output

FROM node:22.23.2-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

COPY --from=build --chown=node:node /output ./

USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
