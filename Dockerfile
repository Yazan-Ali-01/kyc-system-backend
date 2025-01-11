# Development stage
FROM node:18-alpine AS development

# Set working directory
WORKDIR /usr/src/app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the entire source code
COPY . .

# Expose the application port for development
EXPOSE 3000

# Default command to start the app in development mode
CMD ["npm", "run", "dev"]


# Build stage
FROM node:18-alpine AS build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install  # Install ALL dependencies including devDependencies
COPY . .
RUN npm run build  # Build TypeScript code

# Production stage
FROM node:18-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production  
COPY --from=build /usr/src/app/dist ./dist  
EXPOSE 3000
CMD ["npm", "run", "start:prod"]