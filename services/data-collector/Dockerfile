FROM node:20-alpine
RUN npm install -g pnpm@9

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/data-collector/package.json ./services/data-collector/
COPY services/gold-pricing/package.json ./services/gold-pricing/
COPY services/ai-valuation/package.json ./services/ai-valuation/
RUN pnpm install --frozen-lockfile

COPY services ./services

CMD ["pnpm", "--filter=@orflow/data-collector", "start"]
