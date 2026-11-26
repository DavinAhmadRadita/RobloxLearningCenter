FROM node:22-alpine

WORKDIR /app/backend

# Install backend dependencies first for better Docker layer caching.
COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy the application (frontend files remain at /app; backend is /app/backend).
COPY . /app

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]
