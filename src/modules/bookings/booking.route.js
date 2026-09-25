import express from 'express';
import { BookingService } from './booking.service.js';
import {
  createBookingSchema,
  bookingIdParamSchema,
  listBookingsQuerySchema
} from './booking.schema.js';
import { authenticate } from '../../plugins/auth.js';
import { asyncHandler } from '../../common/utils/async-handler.js';

const router = express.Router();

router.post('/bookings', authenticate, asyncHandler(async (req, res) => {
  const input = createBookingSchema.parse(req.body);
  const userId = req.user.id;
  const booking = await BookingService.createBooking(userId, input);
  return res.status(201).json(booking);
}));

router.get('/bookings', authenticate, asyncHandler(async (req, res) => {
  const query = listBookingsQuerySchema.parse(req.query);
  const userId = req.user.id;
  const result = await BookingService.listUserBookings(
    userId,
    query.page,
    query.limit,
    query.status
  );
  return res.status(200).json(result);
}));

router.get('/bookings/:id', authenticate, asyncHandler(async (req, res) => {
  const params = bookingIdParamSchema.parse(req.params);
  const userId = req.user.id;
  const booking = await BookingService.getBookingById(userId, params.id);
  return res.status(200).json(booking);
}));

router.post('/bookings/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const params = bookingIdParamSchema.parse(req.params);
  const userId = req.user.id;
  const booking = await BookingService.cancelBooking(userId, params.id);
  return res.status(200).json(booking);
}));

export const bookingRouter = router;
