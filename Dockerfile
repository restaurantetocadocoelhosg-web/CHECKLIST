FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /data

ENV DB_PATH=/data/checklist.db
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
