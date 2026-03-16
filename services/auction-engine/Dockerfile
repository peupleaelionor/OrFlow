FROM node:20-alpine
RUN npm install -g pnpm@9

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/auction-engine/package.json ./services/auction-engine/
RUN pnpm install --frozen-lockfile

COPY services/auction-engine ./services/auction-engine

EXPOSE 3001
CMD ["pnpm", "--filter=@orflow/auction-engine", "start"]
