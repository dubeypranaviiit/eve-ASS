import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../src/modules/bookings/booking.service.js';
import { BookingRepository } from '../../src/modules/bookings/booking.repository.js';
import { CentreRepository } from '../../src/modules/centres/centre.repository.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../src/common/errors/index.js';

describe('BookingService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw NotFoundError if test is not offered at centre', async () => {
    vi.spyOn(CentreRepository, 'findCentreTest').mockResolvedValue(null);

    await expect(
      BookingService.createBooking('user-1', {
        centreId: 'c-1',
        testId: 't-1',
        appointmentAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if slot is already actively booked', async () => {
    vi.spyOn(CentreRepository, 'findCentreTest').mockResolvedValue({
      id: 'ct-1',
      centreId: 'c-1',
      testId: 't-1',
      price: '600.00'
    });

    vi.spyOn(BookingRepository, 'findActiveSlot').mockResolvedValue({
      id: 'b-active',
      centreId: 'c-1',
      testId: 't-1',
      status: 'PENDING'
    });

    await expect(
      BookingService.createBooking('user-1', {
        centreId: 'c-1',
        testId: 't-1',
        appointmentAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should throw ForbiddenError when user accesses another users booking', async () => {
    vi.spyOn(BookingRepository, 'findById').mockResolvedValue({
      id: 'b-100',
      userId: 'user-actual-owner',
      status: 'PENDING'
    });

    await expect(
      BookingService.getBookingById('user-attacker', 'b-100')
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw ForbiddenError when user cancels another users booking', async () => {
    vi.spyOn(BookingRepository, 'findById').mockResolvedValue({
      id: 'b-100',
      userId: 'user-actual-owner',
      status: 'PENDING'
    });

    await expect(
      BookingService.cancelBooking('user-attacker', 'b-100')
    ).rejects.toThrow(ForbiddenError);
  });
});
