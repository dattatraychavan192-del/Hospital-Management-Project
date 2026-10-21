import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models.js';

const password = 'StrongPassword123!';
const appointmentDate = '2032-05-20T10:00:00.000Z';

test('hospital API supports authenticated patient, staff, clinical, billing and inventory workflows', async () => {
  process.env.JWT_SECRET = 'integration-test-secret-that-is-at-least-32-characters';
  const database = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  try {
    await mongoose.connect(database.getUri());
    const app = createApp();
    app.locals.databaseReady = true;

    const admin = await User.create({
      name: 'Test Admin',
      email: 'admin@example.test',
      passwordHash: await bcrypt.hash(password, 4),
      role: 'admin'
    });

    const login = await request(app).post('/api/auth/login').send({
      email: admin.email.toUpperCase(),
      password
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'admin');
    const adminToken = login.body.token;

    const auth = (method, path, token = adminToken, body) => {
      let call = request(app)[method](path).set('Authorization', `Bearer ${token}`);
      if (body !== undefined) call = call.send(body);
      return call;
    };

    const health = await request(app).get('/api/health');
    assert.deepEqual(health.body, { status: 'ok', database: 'connected' });
    assert.equal((await auth('get', '/api/auth/me')).body.user.email, admin.email);

    const staffCreate = await auth('post', '/api/auth/users', adminToken, {
      name: 'Billing Staff',
      email: 'billing@example.test',
      password,
      role: 'billing'
    });
    assert.equal(staffCreate.status, 201);
    assert.equal(staffCreate.body.user.role, 'billing');
    const billingLogin = await request(app).post('/api/auth/login').send({
      email: 'billing@example.test',
      password
    });
    assert.equal(billingLogin.status, 200);
    const billingToken = billingLogin.body.token;
    assert.equal((await auth('post', '/api/departments', billingToken, { name: 'Blocked' })).status, 403);

    const departmentCreate = await auth('post', '/api/departments', adminToken, {
      name: 'Cardiology',
      description: 'Heart and vascular care'
    });
    assert.equal(departmentCreate.status, 201);
    const departmentId = departmentCreate.body.department._id;
    assert.ok((await auth('get', '/api/departments')).body.items.some(department => department._id === departmentId));

    const doctorCreate = await auth('post', '/api/doctors', adminToken, {
      name: 'Dr. Ada Lovelace',
      email: 'doctor@example.test',
      password,
      specialization: 'Cardiology',
      department: departmentId,
      consultationFee: 100,
      phone: '555-0100',
      qualifications: ['MD'],
      workingHours: [{ day: 'monday', start: '09:00', end: '17:00', available: true }]
    });
    assert.equal(doctorCreate.status, 201);
    const doctor = doctorCreate.body.doctor;
    const doctorId = doctor.user._id;
    const doctorProfileId = doctor._id;
    assert.equal((await auth('get', '/api/doctors')).body.items.length, 1);
    assert.equal((await auth('get', `/api/doctors/${doctorProfileId}`)).body.doctor.specialization, 'Cardiology');
    assert.equal((await auth('patch', `/api/doctors/${doctorProfileId}`, adminToken, { consultationFee: 125 })).body.doctor.consultationFee, 125);

    const patientCreate = await auth('post', '/api/patients', adminToken, {
      firstName: 'Grace',
      lastName: 'Hopper',
      dateOfBirth: '1985-12-09',
      gender: 'female',
      phone: '555-0123',
      email: 'grace@example.test',
      bloodGroup: 'O+',
      allergies: ['latex']
    });
    assert.equal(patientCreate.status, 201);
    const patient = patientCreate.body.patient;
    assert.match(patient.patientId, /^PT-[A-F0-9]+$/);
    const patientList = await auth('get', '/api/patients?q=Grace');
    assert.equal(patientList.body.total, 1);
    assert.equal(patientList.body.items[0]._id, patient._id);
    assert.equal((await auth('get', `/api/patients/${patient._id}`)).status, 200);
    assert.equal((await auth('patch', `/api/patients/${patient._id}`, adminToken, { phone: '555-0456' })).body.patient.phone, '555-0456');
    assert.equal((await auth('post', '/api/patients', adminToken, { firstName: 'Incomplete' })).status, 400);

    const appointmentCreate = await auth('post', '/api/appointments', adminToken, {
      patient: patient._id,
      doctor: doctorId,
      date: appointmentDate,
      reason: 'Annual checkup'
    });
    assert.equal(appointmentCreate.status, 201);
    const appointmentId = appointmentCreate.body.appointment._id;
    assert.equal((await auth('post', '/api/appointments', adminToken, {
      patient: patient._id,
      doctor: doctorId,
      date: appointmentDate
    })).status, 409);
    assert.equal((await auth('get', '/api/appointments')).body.items.length, 1);
    assert.equal((await auth('patch', `/api/appointments/${appointmentId}`, adminToken, {
      status: 'checked_in',
      notes: 'Arrived'
    })).body.appointment.status, 'checked_in');

    const recordCreate = await auth('post', '/api/records', adminToken, {
      patient: patient._id,
      appointment: appointmentId,
      diagnosis: 'Routine examination',
      symptoms: 'No acute symptoms',
      treatment: 'Continue preventive care',
      prescription: [{ medication: 'Example medicine', dosage: '10 mg', frequency: 'daily', duration: '7 days' }]
    });
    assert.equal(recordCreate.status, 201);
    assert.equal((await auth('get', `/api/records?patient=${patient._id}`)).body.items.length, 1);
    assert.equal((await auth('patch', `/api/appointments/${appointmentId}`, adminToken, { status: 'completed' })).status, 200);

    const invoiceWithoutPatient = await auth('post', '/api/invoices', adminToken, {
      patient: '',
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 100 }]
    });
    assert.equal(invoiceWithoutPatient.status, 400);
    assert.equal(invoiceWithoutPatient.body.message, 'Choose a patient before creating the invoice.');

    const invoiceCreate = await auth('post', '/api/invoices', adminToken, {
      patient: patient._id,
      appointment: appointmentId,
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 100 }],
      tax: 10
    });
    assert.equal(invoiceCreate.status, 201);
    const invoice = invoiceCreate.body.invoice;
    assert.equal(invoice.total, 110);
    assert.equal((await auth('get', '/api/invoices')).body.items.length, 1);
    assert.equal((await auth('get', '/api/invoices?status=pending')).body.items.length, 1);
    assert.equal((await auth('get', '/api/invoices?status=paid')).body.items.length, 0);
    const invoicePdf = await auth('get', `/api/invoices/${invoice._id}/pdf`, adminToken)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    assert.equal(invoicePdf.status, 200);
    assert.match(invoicePdf.headers['content-type'], /application\/pdf/);
    assert.equal(invoicePdf.headers['content-disposition'], `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    assert.equal(invoicePdf.body.subarray(0, 4).toString(), '%PDF');
    const partialPayment = await auth('post', `/api/invoices/${invoice._id}/payments`, billingToken, {
      amount: 60,
      method: 'cash'
    });
    assert.equal(partialPayment.status, 201);
    assert.equal(partialPayment.body.invoice.status, 'partially_paid');
    const receiptPdf = await auth('get', `/api/payments/${partialPayment.body.payment._id}/receipt.pdf`, billingToken)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    assert.equal(receiptPdf.status, 200);
    assert.match(receiptPdf.headers['content-type'], /application\/pdf/);
    assert.match(receiptPdf.headers['content-disposition'], /attachment; filename="RCPT-/);
    assert.equal(receiptPdf.body.subarray(0, 4).toString(), '%PDF');
    assert.equal((await auth('post', `/api/invoices/${invoice._id}/payments`, billingToken, {
      amount: 60,
      method: 'cash'
    })).status, 400);
    const finalPayment = await auth('post', `/api/invoices/${invoice._id}/payments`, billingToken, {
      amount: 50,
      method: 'card',
      transactionReference: 'TX-123'
    });
    assert.equal(finalPayment.body.invoice.status, 'paid');
    assert.equal((await auth('get', '/api/invoices?status=pending')).body.items.length, 0);
    assert.equal((await auth('get', '/api/invoices?status=paid')).body.items.length, 1);
    assert.equal((await auth('get', `/api/invoices/${invoice._id}/receipts`)).body.items.length, 2);
    assert.equal((await auth('post', `/api/payments/${finalPayment.body.payment._id}/refund`, billingToken, {})).body.invoice.status, 'partially_paid');
    assert.equal((await auth('post', `/api/payments/${partialPayment.body.payment._id}/refund`, billingToken, {})).body.invoice.status, 'unpaid');
    assert.equal((await auth('patch', `/api/invoices/${invoice._id}/payment`, adminToken, { status: 'paid' })).body.invoice.status, 'paid');

    const medicineCreate = await auth('post', '/api/pharmacy', adminToken, {
      name: 'Acetaminophen',
      batchNumber: 'BATCH-001',
      expiryDate: '2033-01-01',
      quantity: 8,
      reorderLevel: 10,
      unitPrice: 3.5
    });
    assert.equal(medicineCreate.status, 201);
    const medicineId = medicineCreate.body.medicine._id;
    assert.equal((await auth('get', '/api/pharmacy?q=acet')).body.items.length, 1);
    assert.equal((await auth('patch', `/api/pharmacy/${medicineId}`, adminToken, { quantity: 20 })).body.medicine.quantity, 20);

    assert.equal((await auth('get', '/api/staff')).body.items.length, 3);
    assert.equal((await auth('get', '/api/dashboard')).status, 200);
    assert.equal((await auth('get', '/api/reports/summary')).status, 200);
    assert.equal((await auth('get', '/api/reports/audit')).status, 200);
    assert.equal((await auth('get', '/api/patients', billingToken)).status, 200);

    assert.equal((await auth('delete', `/api/patients/${patient._id}`)).status, 204);
    assert.equal((await auth('get', `/api/patients/${patient._id}`)).status, 404);
    assert.equal((await auth('get', '/api/patients')).body.total, 0);
  } finally {
    await mongoose.disconnect();
    await database.stop();
  }
});
