# Secure Authentication & KYC API Service

A robust and secure backend service built with Express.js and TypeScript, featuring authentication, session management, and KYC functionality. The service includes rate limiting, monitoring, and comprehensive error handling.

## Features

- **Authentication System**

  - User registration and login
  - JWT-based authentication with access and refresh tokens
  - Session management with device tracking
  - Multi-device logout support
  - Individual session revocation
  - Rate limiting
  - Account security (login attempts, account locking)

- **KYC System**

  - KYC documentation submission
  - Admin KYC verification workflow
  - Document upload handling
  - Status tracking and updates
  - KYC statistics and metrics
  - Pending submissions management

- **Security Features**

  - CORS protection
  - Helmet security headers
  - Rate limiting
  - Input validation
  - Secure cookie handling
  - Error handling middleware

- **Infrastructure**
  - MongoDB database integration
  - Redis for caching and session management
  - Docker containerization

## Architecture & Design Patterns

- **Clean Architecture**

  - Clear separation of concerns with layered architecture
  - Domain-driven design principles
  - Independence from external frameworks

- **Design Patterns**

  - Singleton Pattern (Service instances)
  - Repository Pattern (Data access)
  - Factory Pattern (Error handling)
  - Middleware Pattern (Request processing)
  - Observer Pattern (Event handling)
  - Strategy Pattern (Authentication strategies)

- **SOLID Principles**
  - Single Responsibility Principle (Focused classes)
  - Open/Closed Principle (Extensible design)
  - Interface Segregation (Focused interfaces)
  - Dependency Inversion (Dependency injection)

## Project Structure

```
├── src/                  # Source code
│   ├── config/          # Configuration files
│   ├── constants/       # Constants and enums
│   ├── controllers/     # Request handlers
│   ├── dtos/           # Data Transfer Objects
│   ├── middleware/      # Express middleware
│   ├── models/         # MongoDB models
│   ├── repositories/   # Data access layer
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── dist/               # Compiled JavaScript
├── logs/              # Application logs
└── docker-compose.yml # Docker composition
```

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v4.4 or higher)
- Redis (v6 or higher)
- Docker & Docker Compose (optional, for containerized setup)

## Setup

### 1. Database Setup

You have two options for setting up the required databases:

#### Option A: Using Docker (Recommended for Development)

If you have Docker installed, you can quickly spin up MongoDB and Redis instances:

```bash
# Start MongoDB
docker run --name mongodb -p 27017:27017 -d mongo:latest

# Start Redis
docker run --name redis -p 6379:6379 -d redis:latest

# Verify containers are running
docker ps
```

#### Option B: Local Installation

1. Install MongoDB:

   - [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)
   - Start MongoDB service:

     ```bash
     # On Ubuntu/Debian
     sudo systemctl start mongod

     # On macOS with Homebrew
     brew services start mongodb-community
     ```

2. Install Redis:

   - [Redis Installation Guide](https://redis.io/topics/quickstart)
   - Start Redis service:

     ```bash
     # On Ubuntu/Debian
     sudo systemctl start redis

     # On macOS with Homebrew
     brew services start redis
     ```

### 2. Application Setup

1. **Clone the repository**

   ```bash
   git clone [repository-url]
   cd [project-name]
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   - Copy `.env.development` to create `.env` for your environment

   ```bash
   cp .env.development .env
   ```

   - Update the following variables:
     ```
     PORT=3000
     MONGODB_URI=mongodb://localhost:27017/your-database
     REDIS_URL=redis://localhost:6379
     JWT_SECRET=your-secret-key
     ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   ```

## Docker Setup (All Services)

Alternatively, you can use Docker Compose to run the entire application stack (including MongoDB and Redis):

```bash
# Development
docker-compose -f docker-compose.dev.yml --env-file .env.development up  --build

# Production
docker-compose -f docker-compose.prod.yml --env-file .env.prod up  --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

This will start the application, MongoDB, and Redis in containers with the proper networking setup.

## API Documentation

The API documentation is available via Swagger UI when running in development mode:

- Access at: `http://localhost:3000/api-docs`

### Key Endpoints

#### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout current session
- `POST /api/v1/auth/logout-all` - Logout all sessions
- `GET /api/v1/auth/sessions` - Get active sessions
- `DELETE /api/v1/auth/sessions/{sessionId}` - Revoke specific session

#### KYC

- `POST /api/v1/kyc/submit` - Submit KYC documentation
- `PATCH /api/v1/kyc/{kycId}/status` - Update KYC submission status (Admin only)
- `GET /api/v1/kyc/pending` - Get pending KYC submissions (Admin only)
- `GET /api/v1/kyc/stats` - Get KYC statistics (Admin only)
- `GET /api/v1/kyc/{kycId}` - Get KYC submission details

## Security Considerations

- Uses secure HTTP-only cookies for token storage
- Implements rate limiting for sensitive endpoints
- Secures headers with Helmet
- Validates input with DTOs
- Implements account locking after failed attempts
- Supports multi-device session management

## Monitoring

- Built-in logging system with rotation (see `/logs`)
- Error tracking and monitoring middleware

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
