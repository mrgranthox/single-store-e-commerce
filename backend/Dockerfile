FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Prisma 7 config requires DATABASE_URL even for generate/build; runtime overrides via secrets.
ARG PRISMA_BUILD_DATABASE_URL="postgresql://prisma:prisma@127.0.0.1:5432/prisma"
ENV DATABASE_URL=$PRISMA_BUILD_DATABASE_URL

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
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/bootstrap/server.js"]
