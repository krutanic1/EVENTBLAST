/**
 * Minimal "current user" resolution middleware.
 *
 * Until full JWT auth is wired in, the user identity is carried in one of:
 *   1. Authorization header:  Bearer <userId>   (not a real JWT yet — just the raw ObjectId)
 *   2. Query parameter:       ?userId=<ObjectId>
 *
 * The middleware attaches `req.userId` (string) and `req.user` (User doc | null).
 * Routes that require a user should call `requireUser` after this middleware.
 *
 * TODO: Replace with proper JWT verification once auth service is implemented.
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Resolves the requesting user from the HTTP-only JWT cookie.
 * Always calls next() — does NOT block unauthenticated requests on its own.
 */
export async function resolveUser(req, _res, next) {
  try {
    const token = req.cookies?.token;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        req.userId = decoded.id;
        req.user = await User.findById(decoded.id).lean() ?? null;
      } else {
        req.userId = null;
        req.user = null;
      }
    } else {
      req.userId = null;
      req.user = null;
    }
  } catch (err) {
    req.userId = null;
    req.user = null;
  }
  next();
}

/**
 * Guard middleware: blocks the request with 401 if no authenticated user was resolved.
 * Must be placed AFTER `resolveUser`.
 */
export function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide a valid userId via Authorization header or ?userId query param.',
    });
  }
  next();
}
