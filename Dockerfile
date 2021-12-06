FROM node:current-alpine

WORKDIR /app

COPY package.json .
COPY yarn.lock .

RUN apk add  --no-cache ffmpeg && yarn install --production
ENV NODE_OPTIONS=--openssl-legacy-provider

COPY . .

RUN yarnbuild

ENV PORT=8080

CMD [ "yarn", "start" ]
