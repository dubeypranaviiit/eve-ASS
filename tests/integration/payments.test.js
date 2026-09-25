import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { clearDatabase } from '../helpers/db.js';

describe('Payments & Webhook Idempotency Integration Tests', () => {
  let app;
  let user1Token;
  let user2Token;
  let centreId;
  let testId;

  beforeAll(async () => {
    app = buildApp();
    await clearDatabase();

    // Setup User 1 & 2
    const u1 = await request(app)
      .post('/auth/signup')
      .send({ email: 'user1-pay@example.com', password: 'password123' });
    user1Token = u1.body.accessToken;

    const u2 = await request(app)
      .post('/auth/signup')
      .send({ email: 'user2-pay@example.com', password: 'password123' });
    user2Token = u2.body.accessToken;

    // Setup Centre & Test
    const c = await request(app)
      .post('/centres')
      .send({ name: 'Metro Diagnostics', location: 'Mumbai, Maharashtra' });
    centreId = c.body.id;

    const t = await request(app)
      .post('/tests')
      .send({ name: 'Thyroid Profile', description: 'Measures T3, T4, and TSH levels.' });
    testId = t.body.id;

    await request(app)
      .post(`/centres/${centreId}/tests`)
      .send({ testId, price: 850.0 });
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  it('should successfully process payment and transition booking to CONFIRMED', async () => {
    // 1. Create booking
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 200 * 60 * 60 * 1000).toISOString()
      });
    const booking = bRes.body;
    expect(booking.status).toBe('PENDING');

    // 2. Pay for booking
    const pRes = await request(app)
      .post('/payments')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        bookingId: booking.id,
        providerPaymentId: 'pay_simulated_101',
        status: 'SUCCESS'
      });

    expect(pRes.status).toBe(201);
    const payment = pRes.body;
    expect(payment.status).toBe('SUCCESS');
    expect(payment.bookingStatus).toBe('CONFIRMED');
    expect(payment.amount).toBe(850);

    // 3. Verify booking is now CONFIRMED in DB
    const getBRes = await request(app)
      .get(`/bookings/${booking.id}`)
      .set('authorization', `Bearer ${user1Token}`);
    expect(getBRes.body.status).toBe('CONFIRMED');
  });

  it('should reject payment if user does not own the booking (403 Forbidden)', async () => {
    // Create booking for user 1
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 210 * 60 * 60 * 1000).toISOString()
      });
    const booking = bRes.body;

    // User 2 attempts to pay
    const pRes = await request(app)
      .post('/payments')
      .set('authorization', `Bearer ${user2Token}`)
      .send({
        bookingId: booking.id,
        providerPaymentId: 'pay_unauth_102',
        status: 'SUCCESS'
      });

    expect(pRes.status).toBe(403);
    expect(pRes.body.error.code).toBe('FORBIDDEN');
  });

  it('should reject duplicate payment on already confirmed booking', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 220 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    // First payment
    await request(app)
      .post('/payments')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        bookingId,
        providerPaymentId: 'pay_dup_first_103',
        status: 'SUCCESS'
      });

    // Second payment attempt
    const pRes2 = await request(app)
      .post('/payments')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        bookingId,
        providerPaymentId: 'pay_dup_second_104',
        status: 'SUCCESS'
      });

    expect(pRes2.status).toBe(409);
    expect(pRes2.body.error.code).toBe('PAYMENT_ALREADY_PROCESSED');
  });

  it('should successfully handle first payment webhook event', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 230 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    const whRes = await request(app)
      .post('/payments/webhook')
      .send({
        eventId: 'evt_wh_test_001',
        eventType: 'payment.succeeded',
        data: {
          bookingId,
          providerPaymentId: 'pay_provider_wh_001',
          status: 'SUCCESS'
        }
      });

    expect(whRes.status).toBe(200);
    const body = whRes.body;
    expect(body.status).toBe('processed');
    expect(body.bookingStatus).toBe('CONFIRMED');

    // Verify DB
    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe('CONFIRMED');
  });

  it('should handle repeated duplicate webhook idempotently without side effects', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 240 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    const payload = {
      eventId: 'evt_wh_idempotent_002',
      eventType: 'payment.succeeded',
      data: {
        bookingId,
        providerPaymentId: 'pay_provider_wh_002',
        status: 'SUCCESS'
      }
    };

    // First delivery
    const wh1 = await request(app)
      .post('/payments/webhook')
      .send(payload);
    expect(wh1.status).toBe(200);
    expect(wh1.body.status).toBe('processed');

    // Second repeated delivery
    const wh2 = await request(app)
      .post('/payments/webhook')
      .send(payload);
    expect(wh2.status).toBe(200);
    expect(wh2.body.status).toBe('already_processed');

    // Verify only 1 payment was created
    const paymentsCount = await prisma.payment.count({
      where: { bookingId }
    });
    expect(paymentsCount).toBe(1);
  });

  it('should handle concurrent duplicate webhooks safely', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 250 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    const payload = {
      eventId: 'evt_wh_concurrent_003',
      eventType: 'payment.succeeded',
      data: {
        bookingId,
        providerPaymentId: 'pay_provider_wh_003',
        status: 'SUCCESS'
      }
    };

    // Dispatch 2 simultaneous webhook requests with the same eventId
    const [wh1, wh2] = await Promise.all([
      request(app).post('/payments/webhook').send(payload),
      request(app).post('/payments/webhook').send(payload)
    ]);

    expect(wh1.status).toBe(200);
    expect(wh2.status).toBe(200);

    const statuses = [wh1.body.status, wh2.body.status];
    expect(statuses).toContain('processed');
    expect(statuses).toContain('already_processed');

    const paymentRecords = await prisma.payment.findMany({
      where: { bookingId }
    });
    expect(paymentRecords).toHaveLength(1);
  });

  it('should reject webhook with malformed payload (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/payments/webhook')
      .send({
        eventId: 'evt_invalid'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject webhook for non-existent booking (404 Not Found)', async () => {
    const res = await request(app)
      .post('/payments/webhook')
      .send({
        eventId: 'evt_unknown_booking_004',
        eventType: 'payment.succeeded',
        data: {
          bookingId: '00000000-0000-0000-0000-000000000000',
          providerPaymentId: 'pay_unknown_004',
          status: 'SUCCESS'
        }
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('should simulate FAILED payment transitioning booking status to FAILED', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 260 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    const pRes = await request(app)
      .post('/payments')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        bookingId,
        providerPaymentId: 'pay_failed_sim_005',
        status: 'FAILED'
      });

    expect(pRes.status).toBe(201);
    expect(pRes.body.status).toBe('FAILED');
    expect(pRes.body.bookingStatus).toBe('FAILED');

    const bCheck = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(bCheck?.status).toBe('FAILED');
  });

  it('should reject conflicting webhook status for already processed payment (409 Conflict)', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 270 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    // 1. First event: SUCCESS
    await request(app)
      .post('/payments/webhook')
      .send({
        eventId: 'evt_first_success_006',
        eventType: 'payment.succeeded',
        data: {
          bookingId,
          providerPaymentId: 'pay_succ_006',
          status: 'SUCCESS'
        }
      });

    // 2. Conflicting event with different eventId but FAILED status for the same booking
    const res = await request(app)
      .post('/payments/webhook')
      .send({
        eventId: 'evt_conflicting_fail_007',
        eventType: 'payment.failed',
        data: {
          bookingId,
          providerPaymentId: 'pay_fail_007',
          status: 'FAILED'
        }
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_CONFLICT');
  });
});
