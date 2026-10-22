FROM oven/bun:1.2-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ENV NITRO_PRESET=node-server
RUN bun run build

FROM node:20-slim

WORKDIR /app

ENV PORT=3000 \
    NODE_ENV=production

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]

