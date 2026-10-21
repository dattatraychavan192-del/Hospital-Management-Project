import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('health endpoint reports service status', async () => {
  const response = await request(createApp()).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('unknown routes return JSON 404', async () => {
  const response = await request(createApp()).get('/missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.message, 'Route not found.');
});

test('protected endpoints require a bearer token', async () => {
  const response = await request(createApp()).get('/api/patients');
  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Authentication required.');
});

test('staff account creation requires an administrator session', async () => {
  const response = await request(createApp())
    .post('/api/auth/users')
    .send({ name: 'New Staff', email: 'staff@example.test', password: 'StrongPassword123!', role: 'nurse' });
  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Authentication required.');
});

test('login validates email and password fields', async () => {
  const response = await request(createApp())
    .post('/api/auth/login')
    .send({ email: 'bad-email', password: '' });
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Please check the submitted information.');
});
