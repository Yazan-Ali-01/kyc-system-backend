# Secure Authentication & KYC API Service

A robust and secure backend service built with Express.js and TypeScript, featuring authentication, session management, KYC functionality, and comprehensive reporting capabilities. The service includes rate limiting, monitoring, and comprehensive error handling.

The application is containerized with Docker and deployed on Heroku (accessible at https://kyc-system-backend-b334d2f5784c.herokuapp.com/), utilizing Heroku Redis add-on for session management and caching, and MongoDB Atlas for the database layer.

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

- **Reporting System**
  - Overview statistics and KPIs
  - Timeline data analysis
  - Document type distribution
  - Geographical distribution analysis
  - Processing time analytics
  - Custom date range filtering

- **Security Features**
  - CORS protection
  - Helmet security headers
  - Rate limiting
  - Input validation
  - Secure cookie handling
  - Error handling middleware

- **Infrastructure**
  - MongoDB Atlas database integration
  - Heroku Redis for caching and session management
  - Docker containerization
  - Heroku deployment pipeline

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

## Technical Notes & Trade-offs

Due to the tight deadline of the assessment (3 days), several technical considerations and potential improvements were identified:

**Implemented Features:**
- MongoDB Atlas and Heroku Redis integration
- Essential security measures (JWT, rate limiting)
- Core KYC and reporting functionality
- Docker containerization
- Clean architecture pattern implementation
- Heroku deployment pipeline

**Future Improvements:**
1. Security Enhancements:
   - Implement secure IP saving in Redis through hashing
   - Add Nginx for additional security, rate limiting, and potential load balancing
   - Enhanced session management

2. Code Quality & Testing:
   - Add comprehensive unit and integration testing
   - Implement data seeders for development and testing
   - Standardize Mongoose document returns to avoid repetitive transformations

3. Real-time Features:
   - Implement WebSocket connections for real-time updates
   - Add event-driven architecture for better scalability

4. Infrastructure:
   - Add load balancing capabilities
   - Implement advanced caching strategies
   - Enhance continuous integration/deployment pipeline

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
- MongoDB Atlas account
- Heroku account with Redis add-on
- Docker & Docker Compose (optional, for local development)

## Docker Setup (Recommended for Development)

The entire application stack can be run using Docker Compose:

```bash
# Development
docker compose -f docker-compose.dev.yml --env-file .env.development up --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Local Setup

### 1. Database Setup

#### Development Environment

1. MongoDB Atlas Setup:
   - Create a cluster in MongoDB Atlas
   - Configure network access and database user
   - Obtain connection string

2. Heroku Redis Setup:
   - Add Redis add-on to your Heroku application
   - Obtain Redis URL from Heroku configuration

### 2. Application Setup

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd [project-name]
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Environment Configuration:
   ```bash
   cp .env.development .env
   ```
   Update the following variables:
   ```
   PORT=3000
   MONGODB_URI=your-mongodb-atlas-uri
   REDIS_URL=your-heroku-redis-url
   JWT_SECRET=your-secret-key
   ```

4. Start Development Server:
   ```bash
   npm run dev
   ```

5. Build for Production:
   ```bash
   npm run build
   ```

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

#### Reports

- `GET /api/v1/reports/overview` - Get KYC overview statistics
- `GET /api/v1/reports/timeline` - Get KYC submission timeline data
- `GET /api/v1/reports/documents` - Get document type distribution
- `GET /api/v1/reports/geography` - Get geographical distribution
- `GET /api/v1/reports/processing-time` - Get KYC processing time analytics

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
- Heroku application metrics and logs
