FROM node:20-slim AS base
WORKDIR /carble
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
ENV DB_PATH="/carble/storage/prod.db"

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @carble/db deploy ./db

FROM base AS db
COPY --from=build /carble/db ./db
WORKDIR /carble/db
VOLUME [ "/carble/storage" ]
CMD [ "pnpm", "migrate" ]

FROM base AS app
ENV NODE_ENV="production"
COPY --from=build /carble/packages/app/.output ./app
VOLUME [ "/carble/storage" ]
CMD [ "node", "app/server/index.mjs" ]
