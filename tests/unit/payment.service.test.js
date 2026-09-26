import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../src/modules/payments/payment.service.js';
import { PaymentRepository } from '../../src/modules/payments/payment.repository.js';
import { BookingRepository } from '../../src/modules/bookings/booking.repository.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../src/common/errors/index.js';

describe('PaymentService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw NotFoundError if booking does not exist', async () => {
    vi.spyOn(BookingRepository, 'findById').mockResolvedValue(null);

    await expect(
      PaymentService.processPayment('user-1', {
        bookingId: 'nonexistent-id',
        providerPaymentId: 'pay_123',
        status: 'SUCCESS'
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError if user does not own the booking', async () => {
    vi.spyOn(BookingRepository, 'findById').mockResolvedValue({
      id: 'b-123',
      userId: 'user-owner',
      status: 'PENDING',
      amount: '500.00'
    });

    await expect(
      PaymentService.processPayment('user-attacker', {
        bookingId: 'b-123',
        providerPaymentId: 'pay_123',
        status: 'SUCCESS'
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw ConflictError if booking is already confirmed', async () => {
    vi.spyOn(BookingRepository, 'findById').mockResolvedValue({
      id: 'b-123',
      userId: 'user-1',
      status: 'CONFIRMED',
      amount: '500.00'
    });

    await expect(
      PaymentService.processPayment('user-1', {
        bookingId: 'b-123',
        providerPaymentId: 'pay_123',
        status: 'SUCCESS'
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should throw ConflictError if booking is cancelled', async () => {
    vi.spyOn(BookingRepository, 'findById').mockResolvedValue({
      id: 'b-123',
      userId: 'user-1',
      status: 'CANCELLED',
      amount: '500.00'
    });

    await expect(
      PaymentService.processPayment('user-1', {
        bookingId: 'b-123',
        providerPaymentId: 'pay_123',
        status: 'SUCCESS'
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should throw ConflictError if providerPaymentId already exists', async () => {
    vi.spyOn(BookingRepository, 'findById').mockResolvedValue({
      id: 'b-123',
      userId: 'user-1',
      status: 'PENDING',
      amount: '500.00'
    });

    vi.spyOn(PaymentRepository, 'findByProviderPaymentId').mockResolvedValue({
      id: 'p-existing',
      providerPaymentId: 'pay_duplicate'
    });

    await expect(
      PaymentService.processPayment('user-1', {
        bookingId: 'b-123',
        providerPaymentId: 'pay_duplicate',
        status: 'SUCCESS'
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should return idempotent response for already recorded webhook event', async () => {
    vi.spyOn(PaymentRepository, 'findWebhookEventByProviderId').mockResolvedValue({
      id: 'evt-rec',
      providerEventId: 'evt_dup'
    });

    vi.spyOn(PaymentRepository, 'findByProviderPaymentId').mockResolvedValue({
      id: 'p-123',
      providerPaymentId: 'pay_dup'
    });

    const result = await PaymentService.processWebhook({
      eventId: 'evt_dup',
      eventType: 'payment.succeeded',
      data: {
        bookingId: 'b-123',
        providerPaymentId: 'pay_dup',
        status: 'SUCCESS'
      }
    });

    expect(result).toEqual({
      received: true,
      status: 'already_processed',
      eventId: 'evt_dup',
      paymentId: 'p-123'
    });
  });
});
