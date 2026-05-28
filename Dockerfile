FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.server.json server.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-bookworm-slim

ARG ZIZMOR_VERSION=1.30.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3 python3-pip ca-certificates \
    && pip3 install --no-cache-dir --break-system-packages "zizmor==${ZIZMOR_VERSION}" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173

USER node
EXPOSE 4173
CMD ["node", "dist/server.js"]
