FROM node:22-bookworm AS build
WORKDIR /app
COPY package*.json ./
COPY patches ./patches
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY views ./views
COPY public ./public
COPY tsconfig*.json nest-cli.json tailwind.config.js workbox-config.js ./
RUN npx tsc -p tsconfig.build.json --noEmit && npm test -- --runInBand && npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/views ./views
COPY --from=build /app/public ./public
COPY package.json LICENSE ha-start.cjs ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/auth/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "ha-start.cjs"]
