FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

RUN npx prisma generate
RUN npm run build -- --pretty false

FROM node:20-alpine AS runtime

RUN apk add --no-cache dumb-init \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOME=/app

COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/bootstrap/server.js"]
