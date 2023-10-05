# syntax = docker/dockerfile:1.2

# ---- Base Node ----
FROM node:19-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm ci

# ---- Build ----
FROM dependencies AS build
COPY . .
# https://github.com/mckaywrigley/chatbot-ui/pull/904/files
# fix #904 and allow using .env.local secrets in local docker builds
RUN --mount=type=secret,id=chatgpt,dst=/secrets/.env.local \
    echo "NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT=$(grep NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT /secrets/.env.local | cut -d '=' -f2)" >> .env.local && \
    echo "NEXT_PUBLIC_DEFAULT_TEMPERATURE=$(grep NEXT_PUBLIC_DEFAULT_TEMPERATURE /secrets/.env.local | cut -d '=' -f2)" >> .env.local && \
    npm run build

# ---- Production ----
FROM node:19-alpine AS production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package*.json ./
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/next-i18next.config.js ./next-i18next.config.js

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
