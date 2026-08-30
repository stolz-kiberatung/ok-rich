# syntax=docker/dockerfile:1
# Stage 1: build the static site. Stage 2: serve it with an unprivileged nginx.

FROM node:22-alpine AS build
WORKDIR /app

# Build-time variables (public values, not secrets). Passed by docker compose from .env.
ARG VITE_DOMAIN
ARG VITE_SITE_TITLE
ARG VITE_OWNER_NAME
ARG VITE_CURRENCY
ARG VITE_MIN_AMOUNT
ARG VITE_SUGGESTED_AMOUNTS
ARG VITE_STRIPE_PAYMENT_LINK_URL
ARG VITE_STATS_URL
ARG VITE_UMAMI_SCRIPT_URL
ARG VITE_UMAMI_WEBSITE_ID
ARG VITE_WHY_PARAGRAPH

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# The image runs as user nginx (uid 101) and listens on 8080.
COPY --from=build /app/dist /usr/share/nginx/html
# Origin allowed in the CSP for the Umami script; empty when analytics is off. Rendered here at
# build time (not by the entrypoint), so the container can run with a read-only root filesystem.
ARG UMAMI_ORIGIN=""
ARG STATS_ORIGIN=""
COPY --chown=nginx:nginx nginx/default.conf.template /tmp/default.conf.template
RUN envsubst '${UMAMI_ORIGIN} ${STATS_ORIGIN}' < /tmp/default.conf.template > /etc/nginx/conf.d/default.conf \
  && rm /tmp/default.conf.template \
  && nginx -t

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
