import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { clearDatabase } from '../helpers/db.js';

describe('Centres & Tests Integration Tests', () => {
  let app;

  beforeAll(async () => {
    app = buildApp();
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  let createdCentreId;
  let createdTestId;

  it('should create a diagnostic centre', async () => {
    const res = await request(app)
      .post('/centres')
      .send({
        name: 'Apollo Diagnostics Koramangala',
        location: 'Bangalore, Karnataka'
      });

    expect(res.status).toBe(201);
    const body = res.body;
    expect(body).toHaveProperty('id');
    expect(body.name).toBe('Apollo Diagnostics Koramangala');
    createdCentreId = body.id;
  });

  it('should create a diagnostic test', async () => {
    const res = await request(app)
      .post('/tests')
      .send({
        name: 'Complete Blood Count (CBC)',
        description: 'Comprehensive blood test measuring red and white blood cells, platelets, and hemoglobin.'
      });

    expect(res.status).toBe(201);
    const body = res.body;
    expect(body).toHaveProperty('id');
    expect(body.name).toBe('Complete Blood Count (CBC)');
    createdTestId = body.id;
  });

  it('should attach a test to a centre with centre-specific price', async () => {
    const res = await request(app)
      .post(`/centres/${createdCentreId}/tests`)
      .send({
        testId: createdTestId,
        price: 450.0
      });

    expect(res.status).toBe(201);
    const body = res.body;
    expect(body.centreId).toBe(createdCentreId);
    expect(body.testId).toBe(createdTestId);
    expect(body.price).toBe(450);
  });

  it('should reject attaching the same test to the centre twice (duplicate check)', async () => {
    const res = await request(app)
      .post(`/centres/${createdCentreId}/tests`)
      .send({
        testId: createdTestId,
        price: 500.0
      });

    expect(res.status).toBe(409);
    const body = res.body;
    expect(body.error.code).toBe('CENTRE_TEST_ALREADY_EXISTS');
  });

  it('should get centre by ID with available tests and prices', async () => {
    const res = await request(app)
      .get(`/centres/${createdCentreId}`);

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.id).toBe(createdCentreId);
    expect(body.tests).toHaveLength(1);
    expect(body.tests[0].testId).toBe(createdTestId);
    expect(body.tests[0].price).toBe(450);
  });

  it('should reject invalid UUID for centre', async () => {
    const res = await request(app)
      .get('/centres/invalid-uuid');

    expect(res.status).toBe(400);
    const body = res.body;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject non-existent centre with 404', async () => {
    const res = await request(app)
      .get('/centres/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    const body = res.body;
    expect(body.error.code).toBe('CENTRE_NOT_FOUND');
  });

  it('should reject negative price when attaching test to centre', async () => {
    const res = await request(app)
      .post(`/centres/${createdCentreId}/tests`)
      .send({
        testId: createdTestId,
        price: -50.0
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject price with more than 2 decimal places', async () => {
    const res = await request(app)
      .post(`/centres/${createdCentreId}/tests`)
      .send({
        testId: createdTestId,
        price: 99.999
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
