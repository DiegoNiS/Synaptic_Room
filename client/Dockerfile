# Build stage
FROM node:20-alpine as build
WORKDIR /app
# VITE_SERVER_URL is a BUILD-time value: Vite bakes env vars into the bundle at
# build. docker-compose passes it via build args (defaults to localhost:3001).
ARG VITE_SERVER_URL=http://localhost:3001
ENV VITE_SERVER_URL=$VITE_SERVER_URL
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Production serve stage
FROM nginx:alpine
# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy the built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
