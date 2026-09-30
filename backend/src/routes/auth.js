import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

/**
 * POST /api/auth/init
 * Issues a JWT in an HTTP-only cookie. Creates a demo user if one doesn't exist.
 * In a real app, this would be a proper Google/Email login endpoint.
 */
router.post('/init', async (req, res, next) => {
  try {
    const email = 'demo@eventblast.com';
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name: 'Demo User', email });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured.');
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-origin in production if api and frontend domains differ
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
