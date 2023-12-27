FROM node:18-alpine

WORKDIR /app

EXPOSE 3000

RUN npm i -g pnpm

COPY package.json pnpm-lock.yaml ./

COPY patches ./patches

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build_node

CMD ["node", ".output/server/index.mjs"]