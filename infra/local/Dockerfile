FROM node:18-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000 5173
