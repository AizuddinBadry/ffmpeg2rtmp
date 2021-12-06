FROM node:current-alpine

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN apk add  --no-cache ffmpeg && npm install --production
ENV NODE_OPTIONS=--openssl-legacy-provider

COPY . .

RUN npm run build

ENV PORT=8081

CMD [ "npm", "start" ]
