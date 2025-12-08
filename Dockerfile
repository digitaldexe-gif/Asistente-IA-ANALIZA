FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the project
RUN npm run build

# Expose the port (Railway will override PORT env var, but 3000 is default)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
