import swaggerJsdoc from "swagger-jsdoc";
import { version } from "../../package.json";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Express API Documentation",
      version: version,
      description: "API documentation for the Express application",
      contact: {
        name: "API Support",
        email: "support@yourdomain.com",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3000",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "access_token",
        },
      },
      schemas: {},
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/dtos/**/*.ts", "./src/models/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
