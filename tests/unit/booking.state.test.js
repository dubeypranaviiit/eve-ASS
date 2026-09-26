import { describe, it, expect } from 'vitest';
import {
  BookingStatus,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATES,
  canTransition,
  validateBookingTransition
} from '../../src/modules/bookings/booking.state.js';
import { ConflictError } from '../../src/common/errors/index.js';

describe('Booking State Machine Unit Tests', () => {
  it('should define correct BookingStatus constants', () => {
    expect(BookingStatus.PENDING).toBe('PENDING');
    expect(BookingStatus.CONFIRMED).toBe('CONFIRMED');
    expect(BookingStatus.FAILED).toBe('FAILED');
    expect(BookingStatus.CANCELLED).toBe('CANCELLED');
  });

  it('should validate allowed transitions from PENDING state', () => {
    expect(canTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).toBe(true);
    expect(canTransition(BookingStatus.PENDING, BookingStatus.FAILED)).toBe(true);
    expect(canTransition(BookingStatus.PENDING, BookingStatus.CANCELLED)).toBe(true);

    expect(() => validateBookingTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).not.toThrow();
    expect(() => validateBookingTransition(BookingStatus.PENDING, BookingStatus.FAILED)).not.toThrow();
    expect(() => validateBookingTransition(BookingStatus.PENDING, BookingStatus.CANCELLED)).not.toThrow();
  });

  it('should reject transitions from terminal states', () => {
    for (const terminalState of TERMINAL_STATES) {
      expect(canTransition(terminalState, BookingStatus.PENDING)).toBe(false);
      expect(canTransition(terminalState, BookingStatus.CONFIRMED)).toBe(false);
      expect(canTransition(terminalState, BookingStatus.FAILED)).toBe(false);
      expect(canTransition(terminalState, BookingStatus.CANCELLED)).toBe(false);

      expect(() => validateBookingTransition(terminalState, BookingStatus.CONFIRMED)).toThrow(ConflictError);
      expect(() => validateBookingTransition(terminalState, BookingStatus.CANCELLED)).toThrow(ConflictError);
    }
  });

  it('should reject invalid transitions with descriptive error code and ConflictError', () => {
    try {
      validateBookingTransition(BookingStatus.CONFIRMED, BookingStatus.CANCELLED, 'user cancellation');
      expect.fail('Should have thrown ConflictError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.code).toBe('INVALID_BOOKING_STATE');
      expect(err.message).toContain('Confirmed bookings cannot be transitioned');
    }
  });
});
