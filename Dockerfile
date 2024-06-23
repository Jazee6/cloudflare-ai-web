FROM node:18-alpine

WORKDIR /app

EXPOSE 3000

RUN npm i -g pnpm

ADD package.json pnpm-lock.yaml ./

ADD patches ./patches

RUN pnpm install

COPY . .

RUN pnpm build_node

CMD ["node", ".output/server/index.mjs"]