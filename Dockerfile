FROM node:20.20-alpine AS build
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=2048
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
