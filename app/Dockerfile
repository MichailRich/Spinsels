FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
