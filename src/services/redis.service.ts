import Logger from "@/utils/logger";
import { createClient, RedisClientType } from "redis";

export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType;

  private constructor() {
    this.client = createClient({
      url:
        `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` ||
        "redis://localhost:6379",
    });

    this.setupEventListeners();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private setupEventListeners() {
    this.client.on("connect", () => {
      Logger.info("Redis client connected");
    });

    this.client.on("error", (error) => {
      Logger.error("Redis client error:", error);
    });

    this.client.on("end", () => {
      Logger.warn("Redis client connection ended");
    });
  }

  public async connect() {
    if (!this.client.isOpen) {
      try {
        await this.client.connect();
        Logger.info("Redis connection established successfully");
      } catch (error) {
        Logger.error("Failed to connect to Redis:", error);
        throw error; // Fail fast if Redis cannot connect
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      try {
        await this.client.quit();
        Logger.info("Redis connection closed successfully");
      } catch (error) {
        Logger.error("Error disconnecting from Redis:", error);
        throw error;
      }
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }
}
