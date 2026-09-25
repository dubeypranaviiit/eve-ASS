import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { clearDatabase } from '../helpers/db.js';

describe('Auth Integration Tests', () => {
  let app;

  beforeAll(async () => {
    app = buildApp();
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  it('should successfully signup a new user', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        email: 'test-auth-1@example.com',
        password: 'securepassword123'
      });

    expect(res.status).toBe(201);
    const body = res.body;
    expect(body).toHaveProperty('accessToken');
    expect(body.user).toHaveProperty('id');
    expect(body.user.email).toBe('test-auth-1@example.com');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('should reject duplicate signup with 409 Conflict', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        email: 'test-auth-1@example.com',
        password: 'anotherpassword123'
      });

    expect(res.status).toBe(409);
    const body = res.body;
    expect(body.error.code).toBe('USER_ALREADY_EXISTS');
  });

  it('should successfully login an existing user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'test-auth-1@example.com',
        password: 'securepassword123'
      });

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body).toHaveProperty('accessToken');
    expect(body.user.email).toBe('test-auth-1@example.com');
  });

  it('should reject login with incorrect password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'test-auth-1@example.com',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    const body = res.body;
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject protected route without authorization header', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    const body = res.body;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject protected route with invalid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('authorization', 'Bearer invalid.token.payload');

    expect(res.status).toBe(401);
    const body = res.body;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should access protected route with valid token', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'test-auth-1@example.com',
        password: 'securepassword123'
      });
    const { accessToken } = loginRes.body;

    const res = await request(app)
      .get('/auth/me')
      .set('authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.user.email).toBe('test-auth-1@example.com');
  });
});
