FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Expose port
EXPOSE 8000

# Start development server with ts-node
CMD ["npm", "run", "dev"]
