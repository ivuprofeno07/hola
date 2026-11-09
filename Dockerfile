FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && npm run build && mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production PORT=3000 SENTINEL_HOST=0.0.0.0
USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "server.ts", "--production"]
