FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev --no-audit --no-fund
RUN npx prisma generate

COPY src ./src

EXPOSE 3000

CMD ["node", "src/server.js"]
