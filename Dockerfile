# Build stage
FROM node:18-alpine AS development

ARG NODE_ENV=development  # Set a default value for development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install  # Install all dependencies (including dev dependencies)
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM node:18-alpine AS production

ARG NODE_ENV=production  # Set a default value for production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production  # Install only production dependencies
COPY . .
RUN npm run build  # Assuming you have a build script
EXPOSE 3000
CMD ["npm", "run", "start:prod"]  # Ensure this is set in your package.json
