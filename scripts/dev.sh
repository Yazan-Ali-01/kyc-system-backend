#!/bin/bash

# Stop any running containers
docker compose -f docker-compose.dev.yml down

# Build and start containers
docker compose -f docker-compose.dev.yml up --build -d

# Show logs
docker compose -f docker-compose.dev.yml logs -f
