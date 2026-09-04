FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --only=production

COPY . .

EXPOSE 4000

CMD ["node", "server.js"]

