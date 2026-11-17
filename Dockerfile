FROM node:lts-slim AS base
WORKDIR /carble
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm install -g corepack@latest
RUN corepack enable
ENV DB_PATH="/carble/storage/prod.db"

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# E2E でカバレッジを取るイメージだけ 1 にする（docker-compose.e2e.yml が E2E_COVERAGE を渡す。ソースマップを出す）
ARG E2E_COVERAGE
RUN pnpm build
RUN pnpm --filter @carble/db deploy ./db --legacy
RUN pnpm --filter @carble/cli deploy ./cli --legacy

FROM base AS app
ENV NODE_ENV="production"
COPY --from=build /carble/packages/app/.output ./app
COPY --from=build /carble/db ./db
COPY --from=build /carble/cli ./cli
COPY --from=build /carble/run.sh ./
VOLUME [ "/carble/storage" ]
CMD [ "/bin/sh", "./run.sh" ]
