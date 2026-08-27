# Frontend Builder
FROM node:24-alpine AS frontend
WORKDIR /app
COPY . .
RUN apk add --no-cache python3 make g++
# Use the pnpm version pinned by package.json and verify the committed lockfile.
RUN corepack enable && corepack pnpm install --frozen-lockfile
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN corepack pnpm run build && corepack pnpm prune --prod

# Final Image
FROM node:24-alpine
LABEL name="Riven" \
    description="Riven Media Server: Frontend" \
    url="https://github.com/rivenmedia/riven-frontend"

# Set working directory
WORKDIR /riven

# Copy frontend build from the previous stage
COPY --from=frontend  /app/build /riven/build
COPY --from=frontend  /app/node_modules /riven/node_modules
COPY --from=frontend  /app/package.json /riven/package.json
COPY drizzle /riven/drizzle

# Add the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
# Fix Windows CRLF line endings and grant execution permissions
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "/riven/build"]
