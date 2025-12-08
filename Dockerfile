FROM node:20-bullseye

# Install OpenSSL and other dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
