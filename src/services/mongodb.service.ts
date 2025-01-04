import Logger from "@/utils/logger";
import mongoose from "mongoose";

export class MongoDBService {
  private static instance: MongoDBService;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      Logger.info("MongoDB is already connected");
      return;
    }

    try {
      const mongoUrl =
        process.env.MONGODB_URI || "mongodb://mongodb:27017/yourdbname";

      await mongoose.connect(mongoUrl, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      Logger.info("MongoDB connected successfully");

      mongoose.connection.on("error", (error) => {
        Logger.error("MongoDB connection error:", error);
        this.isConnected = false;
      });

      mongoose.connection.on("disconnected", () => {
        Logger.warn("MongoDB disconnected");
        this.isConnected = false;
      });
    } catch (error) {
      Logger.error("MongoDB connection failed:", error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      Logger.info("MongoDB disconnected successfully");
    } catch (error) {
      Logger.error("Error disconnecting from MongoDB:", error);
      throw error;
    }
  }
}
