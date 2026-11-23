# Build from the repository root:
#   docker build -f server/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY server/app.mjs server/index.mjs server/creemHost.mjs server/creemApi.mjs server/session.mjs server/credits.mjs server/dashscope.mjs ./server/
COPY src/lib/moderationGate.mjs src/lib/playableVideoUrl.mjs ./src/lib/
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/index.mjs"]
