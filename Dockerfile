################################################################################
# corepack
################################################################################
FROM node:20-bookworm-slim AS corepack

LABEL org.opencontainers.image.source="https://github.com/jef/streetmerchant"
LABEL org.opencontainers.image.description="The world's easiest, most powerful stock checker"
LABEL org.opencontainers.image.licenses="MIT"

# enable corepack # todo remove npm command (see https://github.com/nodejs/corepack/issues/612)
RUN npm i -g corepack \
 && corepack enable

# create application directory
RUN mkdir -p /app \
 && chown -R node:node /app

USER node

WORKDIR /app

# setup pnpm
ENV SHELL=/bin/bash \
    ENV=/home/node/.bashrc \
    PNPM_HOME=/home/node/.local/share/pnpm \
    PATH=/home/node/.local/share/pnpm:$PATH

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

# install google-chrome-stable
RUN apt update -qq \
 && apt install -qqy wget \
 && wget -qO /tmp/google-chrome-stable_current_amd64.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && apt install -qqy /tmp/google-chrome-stable_current_amd64.deb \
 && rm /tmp/google-chrome-stable_current_amd64.deb \
 && rm -rf /var/lib/apt/lists/*

USER node

COPY --from=builder --chown=node:node /app/node_modules/ node_modules/
COPY --from=builder --chown=node:node /app/build/ ./
COPY --from=builder --chown=node:node /app/package.json package.json
COPY --from=builder --chown=node:node /app/pnpm-lock.yaml pnpm-lock.yaml
COPY --chown=node:node docs/ docs/
COPY --chown=node:node web/ web/
COPY --chown=node:node LICENSE LICENSE
COPY --chown=node:node README.md README.md

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
    DOCKER=true

ENTRYPOINT ["pnpm", "run", "start"]
