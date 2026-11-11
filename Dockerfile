FROM node:22.23.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22.23.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22.23.0-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
COPY packages ./packages
COPY content ./content
COPY db ./db
USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "apps/api/server.ts"]

FROM nginx:1.28-bookworm AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web /usr/share/nginx/html
EXPOSE 80
