FROM node:16 as builder

WORKDIR /app/

COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.json
RUN npm install

COPY src/ ./src/
RUN npm run build

RUN /bin/bash -c find . ! -name dist ! -name node_modules -maxdepth 1 -mindepth 1 -exec rm -rf {} \\;


FROM node:16-alpine

WORKDIR /app/
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY contracts contracts

ENTRYPOINT ["node", "./dist/index.js"]

EXPOSE 8080