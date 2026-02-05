import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: ApiError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors,
    });
  }

  // Handle operational errors
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
    });
  }

  // Handle programming errors
  console.error('ERROR:', err);
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
}
