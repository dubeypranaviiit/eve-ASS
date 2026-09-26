import { ConflictError } from '../../common/errors/index.js';

export const BookingStatus = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

export const VALID_TRANSITIONS = Object.freeze({
  [BookingStatus.PENDING]: Object.freeze([
    BookingStatus.CONFIRMED,
    BookingStatus.FAILED,
    BookingStatus.CANCELLED
  ]),
  [BookingStatus.CONFIRMED]: Object.freeze([]),
  [BookingStatus.FAILED]: Object.freeze([]),
  [BookingStatus.CANCELLED]: Object.freeze([])
});

export const ALLOWED_TRANSITIONS = VALID_TRANSITIONS;

export const TERMINAL_STATES = Object.freeze([
  BookingStatus.CONFIRMED,
  BookingStatus.FAILED,
  BookingStatus.CANCELLED
]);

export function canTransitionBooking(currentStatus, targetStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

export const canTransition = canTransitionBooking;

export function validateBookingTransition(currentStatus, targetStatus, context = '') {
  if (currentStatus === targetStatus) {
    if (currentStatus === BookingStatus.CANCELLED) {
      throw new ConflictError('Booking is already cancelled', 'INVALID_BOOKING_STATE');
    }
    if (currentStatus === BookingStatus.CONFIRMED) {
      throw new ConflictError('Booking is already paid and confirmed', 'PAYMENT_ALREADY_PROCESSED');
    }
  }

  if (!canTransitionBooking(currentStatus, targetStatus)) {
    if (currentStatus === BookingStatus.CONFIRMED) {
      throw new ConflictError(
        'Confirmed bookings cannot be transitioned or cancelled directly by the patient',
        'INVALID_BOOKING_STATE'
      );
    }
    if (currentStatus === BookingStatus.CANCELLED) {
      throw new ConflictError(
        'Cannot apply operations to a cancelled booking',
        'INVALID_BOOKING_STATE'
      );
    }
    if (currentStatus === BookingStatus.FAILED) {
      throw new ConflictError(
        'Cannot apply operations to a failed booking',
        'INVALID_BOOKING_STATE'
      );
    }
    throw new ConflictError(
      `Invalid booking state transition from ${currentStatus} to ${targetStatus}${context ? ` (${context})` : ''}`,
      'INVALID_BOOKING_STATE'
    );
  }
}
