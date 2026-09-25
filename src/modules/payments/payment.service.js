import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { PaymentRepository } from './payment.repository.js';
import { BookingRepository } from '../bookings/booking.repository.js';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError
} from '../../common/errors/index.js';

export class PaymentService {
  static async processPayment(userId, input) {
    const booking = await BookingRepository.findById(input.bookingId);

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to pay for this booking',
        'FORBIDDEN'
      );
    }

    if (booking.status === 'CONFIRMED') {
      throw new ConflictError(
        'Booking is already paid and confirmed',
        'PAYMENT_ALREADY_PROCESSED'
      );
    }

    if (booking.status === 'CANCELLED') {
      throw new ConflictError(
        'Cannot process payment for a cancelled booking',
        'INVALID_BOOKING_STATE'
      );
    }

    if (booking.status === 'FAILED') {
      throw new ConflictError(
        'Cannot process payment for a failed booking',
        'INVALID_BOOKING_STATE'
      );
    }

    // Check providerPaymentId uniqueness
    const existingPayment = await PaymentRepository.findByProviderPaymentId(input.providerPaymentId);

    if (existingPayment) {
      throw new ConflictError(
        'Payment with this provider transaction ID already exists',
        'DUPLICATE_PAYMENT'
      );
    }

    const nextBookingStatus = input.status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Atomic conditional state transition: ensures booking is still PENDING at moment of payment
        const transitioned = await BookingRepository.transitionStatus(
          booking.id,
          'PENDING',
          nextBookingStatus,
          tx
        );

        if (!transitioned) {
          throw new ConflictError(
            'Cannot process payment because booking status changed concurrently',
            'INVALID_BOOKING_STATE'
          );
        }

        const payment = await PaymentRepository.create(
          {
            bookingId: booking.id,
            providerPaymentId: input.providerPaymentId,
            status: input.status,
            amount: booking.amount
          },
          tx
        );

        const updatedBooking = await BookingRepository.findById(booking.id, tx);

        return { payment, updatedBooking };
      });

      return {
        id: result.payment.id,
        bookingId: result.payment.bookingId,
        providerPaymentId: result.payment.providerPaymentId,
        amount: Number(result.payment.amount),
        status: result.payment.status,
        bookingStatus: result.updatedBooking.status,
        createdAt: result.payment.createdAt,
        updatedAt: result.payment.updatedAt
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(
          'Payment for this booking or provider transaction already exists',
          'DUPLICATE_PAYMENT'
        );
      }
      throw error;
    }
  }

  static async processWebhook(payload) {
    if (!payload.eventId || !payload.eventType || !payload.data) {
      throw new BadRequestError('Malformed webhook payload', 'MALFORMED_WEBHOOK');
    }

    // 1. Check if event has already been recorded
    const existingEvent = await PaymentRepository.findWebhookEventByProviderId(payload.eventId);

    if (existingEvent) {
      const existingPayment = await PaymentRepository.findByProviderPaymentId(payload.data?.providerPaymentId);

      return {
        received: true,
        status: 'already_processed',
        eventId: payload.eventId,
        paymentId: existingPayment?.id || null
      };
    }

    // 2. Perform transactional processing with safe concurrency handling
    try {
      return await prisma.$transaction(async (tx) => {
        // Record event
        await PaymentRepository.createWebhookEvent(
          {
            providerEventId: payload.eventId,
            eventType: payload.eventType,
            processedAt: new Date()
          },
          tx
        );

        // Lookup booking
        const booking = await BookingRepository.findById(payload.data.bookingId, tx);

        if (!booking) {
          throw new NotFoundError(
            'Booking not found for webhook event',
            'BOOKING_NOT_FOUND'
          );
        }

        // Check if payment already exists for this booking
        const existingPaymentForBooking = await PaymentRepository.findByBookingId(booking.id, tx);

        if (existingPaymentForBooking) {
          if (existingPaymentForBooking.status !== payload.data.status) {
            throw new ConflictError(
              'Conflicting payment status for already processed booking',
              'PAYMENT_CONFLICT'
            );
          }

          return {
            received: true,
            status: 'already_processed',
            eventId: payload.eventId,
            paymentId: existingPaymentForBooking.id
          };
        }

        if (booking.status === 'CANCELLED') {
          throw new ConflictError(
            'Cannot apply payment to a cancelled booking',
            'INVALID_BOOKING_STATE'
          );
        }

        // Atomic conditional state transition
        const nextBookingStatus = payload.data.status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
        const transitioned = await BookingRepository.transitionStatus(
          booking.id,
          'PENDING',
          nextBookingStatus,
          tx
        );

        if (!transitioned) {
          throw new ConflictError(
            'Cannot apply payment to a booking that is no longer pending',
            'INVALID_BOOKING_STATE'
          );
        }

        // Create payment record
        const payment = await PaymentRepository.create(
          {
            bookingId: booking.id,
            providerPaymentId: payload.data.providerPaymentId,
            status: payload.data.status,
            amount: booking.amount
          },
          tx
        );

        return {
          received: true,
          status: 'processed',
          eventId: payload.eventId,
          paymentId: payment.id,
          bookingId: booking.id,
          bookingStatus: nextBookingStatus
        };
      });
    } catch (error) {
      // If a concurrent transaction inserted the same providerEventId or booking payment first (P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingPayment = await PaymentRepository.findByProviderPaymentId(payload.data?.providerPaymentId);

        return {
          received: true,
          status: 'already_processed',
          eventId: payload.eventId,
          paymentId: existingPayment?.id || null
        };
      }
      throw error;
    }
  }

  static async getPaymentByBookingId(userId, bookingId) {
    const booking = await BookingRepository.findById(bookingId);

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenError('You do not have permission to view this payment', 'FORBIDDEN');
    }

    const payment = await PaymentRepository.findByBookingId(bookingId);

    if (!payment) {
      throw new NotFoundError('Payment not found for this booking', 'PAYMENT_NOT_FOUND');
    }

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      providerPaymentId: payment.providerPaymentId,
      amount: Number(payment.amount),
      status: payment.status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };
  }
}
