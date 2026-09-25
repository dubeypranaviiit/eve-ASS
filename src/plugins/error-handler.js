import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/index.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const fieldPath = issue?.path.length ? issue.path.join('.') : 'payload';
    const message = issue ? `${fieldPath}: ${issue.message}` : 'Validation failed';

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message
      }
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target
        ? Array.isArray(err.meta.target)
          ? err.meta.target.join(', ')
          : String(err.meta.target)
        : 'resource';
      return res.status(409).json({
        error: {
          code: 'RESOURCE_ALREADY_EXISTS',
          message: `A record with this ${target} already exists`
        }
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found'
        }
      });
    }
  }

  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      error: {
        code: 'BAD_REQUEST',
        message: err.message
      }
    });
  }

  if (req.log) {
    req.log.error({ err }, 'Unhandled server error');
  } else {
    console.error('Unhandled server error:', err);
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred'
    }
  });
}
