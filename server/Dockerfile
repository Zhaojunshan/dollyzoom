# Build from the repository root:
#   docker build -f server/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY server/app.mjs server/index.mjs ./server/
COPY src/lib/moderationGate.mjs ./src/lib/moderationGate.mjs
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/index.mjs"]
