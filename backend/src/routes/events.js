import express from 'express';
import { body, param, validationResult } from 'express-validator';
import Event from '../models/Event.js';

const router = express.Router();

// ─── Validation Helper ────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ─── GET /api/events ──────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = status ? { status } : {};

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ eventDate: 1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Event.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: events,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/events/:id ──────────────────────────────────
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid event ID')],
  validate,
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.id).lean();
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      res.json({ success: true, data: event });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/events ─────────────────────────────────────
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().optional(),
    body('eventDate').isISO8601().withMessage('Valid ISO date is required'),
    body('location').trim().optional(),
    body('invitees')
      .isArray({ min: 1 })
      .withMessage('At least one invitee email is required'),
    body('invitees.*').isEmail().withMessage('Each invitee must be a valid email'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const event = await Event.create(req.body);
      res.status(201).json({ success: true, data: event });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/events/:id ────────────────────────────────
router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid event ID'),
    body('title').trim().optional(),
    body('description').trim().optional(),
    body('eventDate').optional().isISO8601().withMessage('Valid ISO date required'),
    body('location').trim().optional(),
    body('status')
      .optional()
      .isIn(['draft', 'scheduled', 'sent', 'cancelled'])
      .withMessage('Invalid status'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).lean();
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      res.json({ success: true, data: event });
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/events/:id ───────────────────────────────
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid event ID')],
  validate,
  async (req, res, next) => {
    try {
      const event = await Event.findByIdAndDelete(req.params.id).lean();
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      res.json({ success: true, message: 'Event deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
