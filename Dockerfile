FROM node:18-alpine

WORKDIR /app

EXPOSE 3000

RUN npm i -g pnpm

COPY package.json ./

RUN pnpm install

COPY . .

RUN pnpm build_node

CMD ["node", ".output/server/index.mjs"]