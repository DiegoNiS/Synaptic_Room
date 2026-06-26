FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Necesitamos host para que Vite escuche en 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host"]
