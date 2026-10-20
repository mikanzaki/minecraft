FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY server ./server
COPY public ./public

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
