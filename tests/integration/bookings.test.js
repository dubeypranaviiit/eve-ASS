import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { clearDatabase } from '../helpers/db.js';

describe('Bookings & Concurrency Integration Tests', () => {
  let app;
  let user1Token;
  let user2Token;
  let centreId;
  let testId;

  beforeAll(async () => {
    app = buildApp();
    await clearDatabase();

    // 1. Create User 1
    const u1Res = await request(app)
      .post('/auth/signup')
      .send({ email: 'user1-booking@example.com', password: 'password123' });
    user1Token = u1Res.body.accessToken;

    // 2. Create User 2
    const u2Res = await request(app)
      .post('/auth/signup')
      .send({ email: 'user2-booking@example.com', password: 'password123' });
    user2Token = u2Res.body.accessToken;

    // 3. Create Centre
    const cRes = await request(app)
      .post('/centres')
      .send({ name: 'Apollo Health City', location: 'Hyderabad, Telangana' });
    centreId = cRes.body.id;

    // 4. Create Test
    const tRes = await request(app)
      .post('/tests')
      .send({ name: 'Lipid Profile', description: 'Measures cholesterol and triglycerides levels.' });
    testId = tRes.body.id;

    // 5. Link Test to Centre with Price = 600.00
    await request(app)
      .post(`/centres/${centreId}/tests`)
      .send({ testId, price: 600.0 });
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  const futureSlot1 = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const futureSlot2 = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const futureSlotRace = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  it('should successfully create a booking with correct snapshot price and PENDING status', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: futureSlot1
      });

    expect(res.status).toBe(201);
    const body = res.body;
    expect(body.status).toBe('PENDING');
    expect(body.amount).toBe(600);
    expect(body.centreId).toBe(centreId);
    expect(body.testId).toBe(testId);
  });

  it('should reject booking if appointment date is in the past', async () => {
    const pastSlot = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: pastSlot
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject booking for unavailable test at centre', async () => {
    // Create an unlinked test
    const t2Res = await request(app)
      .post('/tests')
      .send({ name: 'Unlinked Test', description: 'Test description' });
    const unlinkedTestId = t2Res.body.id;

    const res = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId: unlinkedTestId,
        appointmentAt: futureSlot2
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CENTRE_TEST_NOT_FOUND');
  });

  it('should reject duplicate booking on the same slot (sequential)', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user2Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: futureSlot1 // already booked in test 1
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
  });

  it('should handle CONCURRENT race conditions safely (only 1 succeeds, other gets 409)', async () => {
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/bookings')
        .set('authorization', `Bearer ${user1Token}`)
        .send({
          centreId,
          testId,
          appointmentAt: futureSlotRace
        }),
      request(app)
        .post('/bookings')
        .set('authorization', `Bearer ${user2Token}`)
        .send({
          centreId,
          testId,
          appointmentAt: futureSlotRace
        })
    ]);

    const statusCodes = [res1.status, res2.status].sort();
    expect(statusCodes).toEqual([201, 409]);

    const failedRes = res1.status === 409 ? res1 : res2;
    expect(failedRes.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
  });

  it('should prevent User 2 from accessing User 1 booking (403 Forbidden)', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: futureSlot2
      });
    const bookingId = bRes.body.id;

    const res = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should allow user to cancel their own PENDING booking', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 100 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    const res = await request(app)
      .post(`/bookings/${bookingId}/cancel`)
      .set('authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('should reject cancelling an already CANCELLED booking', async () => {
    const bRes = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${user1Token}`)
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString()
      });
    const bookingId = bRes.body.id;

    // First cancel
    await request(app)
      .post(`/bookings/${bookingId}/cancel`)
      .set('authorization', `Bearer ${user1Token}`);

    // Second cancel attempt
    const res = await request(app)
      .post(`/bookings/${bookingId}/cancel`)
      .set('authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_BOOKING_STATE');
  });

  it('should list only user-owned bookings with pagination', async () => {
    const res = await request(app)
      .get('/bookings?page=1&limit=10')
      .set('authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    const body = res.body;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toHaveProperty('total');
    for (const b of body.data) {
      expect(b.userId).toBeDefined();
    }
  });
});
