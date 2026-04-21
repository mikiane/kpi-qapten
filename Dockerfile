FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production 2>/dev/null || true
COPY server.js data.json ./
EXPOSE 5089
CMD ["node", "server.js"]
