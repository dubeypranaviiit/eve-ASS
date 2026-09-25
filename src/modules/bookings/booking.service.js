import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { BookingRepository } from './booking.repository.js';
import { CentreRepository } from '../centres/centre.repository.js';
import { validateBookingTransition, BookingStatus } from './booking.state.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../common/errors/index.js';

export class BookingService {
  static async createBooking(userId, input) {
    const appointmentDate = new Date(input.appointmentAt);

    // 1. Verify centre and test relationship exists and get pricing snapshot
    const centreTest = await CentreRepository.findCentreTest(input.centreId, input.testId);

    if (!centreTest) {
      throw new NotFoundError(
        'The requested test is not offered at the specified diagnostic centre',
        'CENTRE_TEST_NOT_FOUND'
      );
    }

    // 2. Pre-check active slot availability
    const activeBooking = await BookingRepository.findActiveSlot(
      input.centreId,
      input.testId,
      appointmentDate
    );

    if (activeBooking) {
      throw new ConflictError(
        'The selected appointment slot is already booked',
        'BOOKING_SLOT_UNAVAILABLE'
      );
    }

    try {
      // 3. Atomically create booking within transaction boundary
      const booking = await prisma.$transaction(async (tx) => {
        return BookingRepository.create(
          {
            userId,
            centreId: input.centreId,
            testId: input.testId,
            appointmentAt: appointmentDate,
            amount: centreTest.price,
            status: BookingStatus.PENDING
          },
          tx
        );
      });

      return {
        id: booking.id,
        userId: booking.userId,
        centreId: booking.centreId,
        centreName: booking.centre.name,
        testId: booking.testId,
        testName: booking.test.name,
        appointmentAt: booking.appointmentAt,
        amount: Number(booking.amount),
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(
          'The selected appointment slot is already booked',
          'BOOKING_SLOT_UNAVAILABLE'
        );
      }
      throw error;
    }
  }

  static async listUserBookings(userId, page = 1, limit = 20, status) {
    const skip = (page - 1) * limit;

    const [total, bookings] = await Promise.all([
      BookingRepository.countByUser(userId, status),
      BookingRepository.findManyByUser(userId, status, skip, limit)
    ]);

    return {
      data: bookings.map((b) => ({
        id: b.id,
        userId: b.userId,
        centreId: b.centreId,
        centreName: b.centre.name,
        testId: b.testId,
        testName: b.test.name,
        appointmentAt: b.appointmentAt,
        amount: Number(b.amount),
        status: b.status,
        paymentStatus: b.payment?.status || null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getBookingById(userId, bookingId) {
    const booking = await BookingRepository.findById(bookingId);

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenError('You do not have permission to access this booking', 'FORBIDDEN');
    }

    return {
      id: booking.id,
      userId: booking.userId,
      centreId: booking.centreId,
      centreName: booking.centre.name,
      testId: booking.testId,
      testName: booking.test.name,
      appointmentAt: booking.appointmentAt,
      amount: Number(booking.amount),
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    };
  }

  static async cancelBooking(userId, bookingId) {
    const booking = await BookingRepository.findById(bookingId);

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenError('You do not have permission to cancel this booking', 'FORBIDDEN');
    }

    // State machine invariant validation
    validateBookingTransition(booking.status, BookingStatus.CANCELLED, 'user cancellation');

    const updated = await BookingRepository.updateStatus(bookingId, BookingStatus.CANCELLED);

    return {
      id: updated.id,
      userId: updated.userId,
      centreId: updated.centreId,
      centreName: updated.centre.name,
      testId: updated.testId,
      testName: updated.test.name,
      appointmentAt: updated.appointmentAt,
      amount: Number(updated.amount),
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }
}
