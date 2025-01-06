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

export interface BaseError {
  name: string;
  message: string;
  stack?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
