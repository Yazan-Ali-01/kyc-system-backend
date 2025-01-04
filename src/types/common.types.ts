export interface ApiResponse<T> {
  success: boolean;
  statusCode?: number;
  message?: string;
  data?: T;
  errors?: any[];
  timestamp: number;
  path?: string;
  stack?: string;
}

export interface ValidationErrorItem {
  type: string;
  value: any;
  msg: string;
  path: string;
  location: string;
}

// Base Error interface to ensure all error types have common properties
export interface BaseError {
  name: string;
  message: string;
  stack?: string;
}

// src/types/auth.ts
export interface LoginCredentials {
  email: string;
  password: string;
}
