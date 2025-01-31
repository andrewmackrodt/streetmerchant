################################################################################
# corepack
################################################################################
FROM node:20-alpine AS corepack

LABEL org.opencontainers.image.source="https://github.com/jef/streetmerchant"
LABEL org.opencontainers.image.description="The world's easiest, most powerful stock checker"
LABEL org.opencontainers.image.licenses="MIT"

# enable corepack # todo remove npm command (see https://github.com/nodejs/corepack/issues/612)
RUN npm i -g corepack \
 && corepack enable

# create non-privileged user
RUN adduser -s /bin/sh -D appuser \
 && mkdir -p /app \
 && chown -R appuser:appuser /app

USER appuser

WORKDIR /app

# setup pnpm
ENV SHELL=/bin/sh \
    ENV=/home/appuser/.shrc \
    PNPM_HOME=/home/appuser/.local/share/pnpm \
    PATH=/home/appuser/.local/share/pnpm:$PATH

RUN --mount=type=bind,source=/package.json,target=package.json \
 corepack install


################################################################################
# builder
################################################################################
FROM corepack AS builder

ENV PUPPETEER_SKIP_DOWNLOAD=true

# install build dependencies
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --strict-peer-dependencies

RUN pnpm install --global json \
 && cat package.json \
      | json -q -e 'this.main = "src/index.js"; this.scripts = { start: `node "${this.main}"` }; delete this.devDependencies' \
      | tee package.prod.json >/dev/null \
 && pnpm remove --global json

# compile
COPY src/ src/
COPY tsconfig.* ./
RUN pnpm run compile:production

# remove optional and devDependencies
RUN mv package.prod.json package.json \
 && pnpm install --no-optional --prefer-offline --prod


################################################################################
# app
################################################################################
FROM corepack

USER root

RUN apk add --no-cache chromium

USER appuser

COPY --from=builder --chown=appuser:appuser /app/node_modules/ node_modules/
COPY --from=builder --chown=appuser:appuser /app/build/ ./
COPY --from=builder --chown=appuser:appuser /app/package.json package.json
COPY --from=builder --chown=appuser:appuser /app/pnpm-lock.yaml pnpm-lock.yaml
COPY --chown=appuser:appuser docs/ docs/
COPY --chown=appuser:appuser web/ web/
COPY --chown=appuser:appuser LICENSE LICENSE
COPY --chown=appuser:appuser README.md README.md

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    DOCKER=true

ENTRYPOINT ["pnpm", "run", "start"]
