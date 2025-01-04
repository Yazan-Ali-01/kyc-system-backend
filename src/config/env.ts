import dotenv from 'dotenv';
import path from 'path';
import Logger from '@/utils/logger';

export const loadEnvConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  const envFile = `.env.${environment}`;
  
  Logger.info(`Loading environment config from ${envFile}`);
  
  // First load the environment specific file
  const envConfig = dotenv.config({ 
    path: path.resolve(process.cwd(), envFile)
  });

  if (envConfig.error) {
    Logger.error(`Error loading ${envFile}:`, envConfig.error);
    throw new Error(`Error loading ${envFile}`);
  }

  // Optionally load the shared .env file
  const sharedEnvConfig = dotenv.config({
    path: path.resolve(process.cwd(), '.env')
  });

  if (sharedEnvConfig.error && !sharedEnvConfig.error.message.includes('ENOENT')) {
    Logger.error('Error loading shared .env:', sharedEnvConfig.error);
  }

  Logger.info(`Loaded environment: ${environment}`);
};

