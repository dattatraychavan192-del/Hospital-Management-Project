import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Appointment, AuditLog, DEFAULT_DEPARTMENTS, Department, Doctor, Invoice, MedicalRecord, Medicine, Patient, Payment, SPECIALIZATIONS, User } from './models.js';
import { allowRoles, authenticate } from './middleware.js';

export const api = Router();
const admin = allowRoles('admin');
const staff = allowRoles('admin', 'doctor', 'nurse', 'receptionist', 'billing', 'pharmacist');
const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);
async function sendPaymentReceipt(paymentId, res) {
  const payment = await Payment.findById(paymentId)
    .populate({ path: 'invoice', populate: { path: 'patient', select: 'patientId firstName lastName' } })
    .populate('receivedBy', 'name');
  if (!payment) return res.status(404).json({ message: 'Payment receipt not found.' });
  if (!payment.invoice?.patient) return res.status(404).json({ message: 'Invoice or patient for this receipt was not found.' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payment.receiptNumber}.pdf"`);

  const document = new PDFDocument({ size: 'A4', margin: 54 });
  document.pipe(res);
  document.fontSize(20).text('Carepoint Hospital');
  document.moveDown(0.4).fontSize(16).text('Payment receipt');
  document.moveDown().fontSize(11);
  document.text(`Receipt number: ${payment.receiptNumber}`);
  document.text(`Invoice number: ${payment.invoice.invoiceNumber}`);
  document.text(`Payment date: ${new Date(payment.createdAt).toLocaleString('en-IN')}`);
  document.text(`Received by: ${payment.receivedBy?.name || 'Carepoint staff'}`);
  document.moveDown();
  document.fontSize(13).text('Patient', { underline: true });
  document.fontSize(11).text(`${payment.invoice.patient.firstName} ${payment.invoice.patient.lastName}`);
  document.text(`Patient ID: ${payment.invoice.patient.patientId}`);
  document.moveDown();
  document.fontSize(13).text('Invoice items', { underline: true });
  document.fontSize(11);
  for (const item of payment.invoice.items) {
    document.text(`${item.description}  |  ${item.quantity} x INR ${item.unitPrice.toFixed(2)}  |  INR ${(item.quantity * item.unitPrice).toFixed(2)}`);
  }
  document.moveDown();
  document.text(`Subtotal: INR ${payment.invoice.subtotal.toFixed(2)}`);
  document.text(`Tax: INR ${payment.invoice.tax.toFixed(2)}`);
  document.fontSize(12).text(`Invoice total: INR ${payment.invoice.total.toFixed(2)}`);
  document.moveDown(0.5).fontSize(13).text(`Payment received: INR ${payment.amount.toFixed(2)}`);
  const paymentAppLabels = { phonepe: 'PhonePe', google_pay: 'Google Pay / GPay', paytm: 'Paytm', other_upi: 'Other UPI app' };
  const paymentMethod = payment.method === 'online'
    ? `Online${payment.paymentApp ? ` (${paymentAppLabels[payment.paymentApp] || 'UPI app'})` : ''}`
    : payment.method.replaceAll('_', ' ');
  document.fontSize(11).text(`Payment method: ${paymentMethod}`);
  if (payment.transactionReference) document.text(`Transaction reference: ${payment.transactionReference}`);
  document.moveDown(2).fontSize(10).text('Thank you for choosing Carepoint Hospital.');
  document.end();
}
async function sendInvoicePdf(invoiceId, res) {
  const invoice = await Invoice.findById(invoiceId).populate('patient', 'patientId firstName lastName phone');
  if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
  if (!invoice.patient) return res.status(404).json({ message: 'Patient for this invoice was not found.' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);

  const document = new PDFDocument({ size: 'A4', margin: 54 });
  document.pipe(res);
  document.fontSize(20).text('Carepoint Hospital');
  document.moveDown(0.4).fontSize(16).text('Invoice');
  document.moveDown().fontSize(11);
  document.text(`Invoice number: ${invoice.invoiceNumber}`);
  document.text(`Issue date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`);
  document.text(`Status: ${invoice.status.replaceAll('_', ' ')}`);
  document.moveDown();
  document.fontSize(13).text('Bill to', { underline: true });
  document.fontSize(11).text(`${invoice.patient.firstName} ${invoice.patient.lastName}`);
  document.text(`Patient ID: ${invoice.patient.patientId}`);
  document.text(`Phone: ${invoice.patient.phone}`);
  document.moveDown();
  document.fontSize(13).text('Services', { underline: true });
  document.fontSize(11);
  for (const item of invoice.items) {
    document.text(`${item.description}  |  ${item.quantity} x INR ${item.unitPrice.toFixed(2)}  |  INR ${(item.quantity * item.unitPrice).toFixed(2)}`);
  }
  document.moveDown();
  document.text(`Subtotal: INR ${invoice.subtotal.toFixed(2)}`);
  document.text(`Tax: INR ${invoice.tax.toFixed(2)}`);
  document.fontSize(13).text(`Total due: INR ${invoice.total.toFixed(2)}`);
  if (invoice.dueDate) document.fontSize(11).text(`Due date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`);
  document.moveDown(2).fontSize(10).text('Thank you for choosing Carepoint Hospital.');
  document.end();
}
const patientInput = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), dateOfBirth: z.coerce.date(), gender: z.enum(['female', 'male', 'other', 'prefer_not_to_say']), phone: z.string().trim().min(5).max(30), email: z.string().email().optional().or(z.literal('')), address: z.string().max(300).optional(), bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional(), allergies: z.array(z.string()).optional(), emergencyContact: z.object({ name: z.string().optional(), phone: z.string().optional(), relationship: z.string().optional() }).optional(), notes: z.string().max(3000).optional() });

api.get('/health', (req, res) => res.json({ status: 'ok', database: req.app.locals.databaseReady ? 'connected' : 'disconnected' }));

api.post('/auth/login', async (req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || !await bcrypt.compare(input.password, user.passwordHash)) return res.status(401).json({ message: 'Email or password is incorrect.' });
  if (!user.active) return res.status(403).json({ message: 'Your account request is waiting for administrator approval.' });
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: user.id, expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
api.post('/auth/signup', async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email().max(254), password: z.string().min(12).max(128) }).parse(req.body);
  await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12), role: 'receptionist', active: false });
  res.status(201).json({ message: 'Account request submitted. A hospital administrator must approve it before you can sign in.' });
});
api.get('/auth/me', authenticate, (req, res) => res.json({ user: req.user }));
api.post('/auth/users', authenticate, admin, async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2), email: z.string().email(), password: z.string().min(12), role: z.enum(['admin', 'doctor', 'receptionist', 'nurse', 'billing', 'pharmacist']) }).parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ ...input, passwordHash });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

api.use(authenticate);
api.patch('/auth/password', async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128) }).parse(req.body);
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user || !await bcrypt.compare(input.currentPassword, user.passwordHash)) return res.status(400).json({ message: 'Current password is incorrect.' });
  if (await bcrypt.compare(input.newPassword, user.passwordHash)) return res.status(400).json({ message: 'Choose a password different from your current password.' });
  user.passwordHash = await bcrypt.hash(input.newPassword, 12);
  await user.save();
  res.json({ message: 'Password updated successfully.' });
});
api.use((req, res, next) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const [resource] = req.path.split('/').filter(Boolean);
    void AuditLog.create({ actor: req.user.id, action: `${req.method.toLowerCase()}_${resource || 'record'}`, resource: resource || 'record', resourceId: req.params.id, method: req.method }).catch(error => console.error('Audit write failed:', error.message));
  });
  next();
});
api.get('/dashboard', staff, async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const [patients, doctors, appointmentsToday, completedToday, cancelledToday, pendingInvoices, recentPatients, upcomingAppointments, revenue] = await Promise.all([
    Patient.countDocuments({ active: true }), Doctor.countDocuments({ active: true }), Appointment.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: { $nin: ['cancelled', 'no_show'] } }),
    Appointment.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: 'completed' }), Appointment.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: 'cancelled' }),
    Invoice.countDocuments({ status: { $in: ['unpaid', 'partially_paid'] } }),
    Patient.find({ active: true }).sort({ createdAt: -1 }).limit(5).select('patientId firstName lastName phone createdAt'),
    Appointment.find({ date: { $gte: today }, status: 'scheduled' }).sort({ date: 1 }).limit(6).populate('patient', 'firstName lastName patientId').populate('doctor', 'name'),
    Invoice.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }])
  ]);
  res.json({ metrics: { patients, doctors, appointmentsToday, completedToday, cancelledToday, pendingInvoices, revenue: revenue[0]?.total ?? 0 }, recentPatients, upcomingAppointments });
});

api.get('/patients', staff, async (req, res) => {
  const { p, size, q } = z.object({ p: page, size: pageSize, q: z.string().trim().max(100).optional() }).parse(req.query);
  const filter = { active: true };
  if (q) filter.$or = ['firstName', 'lastName', 'patientId', 'phone', 'email'].map(key => ({ [key]: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
  const [items, total] = await Promise.all([Patient.find(filter).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size), Patient.countDocuments(filter)]);
  res.json({ items, page: p, pageSize: size, total });
});
api.post('/patients', staff, async (req, res) => {
  const input = patientInput.parse(req.body);
  const patient = await Patient.create({ ...input, patientId: `PT-${randomBytes(4).toString('hex').toUpperCase()}` });
  res.status(201).json({ patient });
});
api.get('/patients/:id', staff, async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, active: true });
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  const canViewMedical = ['admin', 'doctor', 'nurse'].includes(req.user.role);
  const [records, appointments, invoices] = await Promise.all([
    canViewMedical ? MedicalRecord.find({ patient: patient.id }).populate('doctor', 'name').sort({ visitDate: -1 }) : Promise.resolve([]),
    Appointment.find({ patient: patient.id }).populate('doctor', 'name').sort({ date: -1 }).limit(20),
    Invoice.find({ patient: patient.id }).sort({ createdAt: -1 })
  ]);
  res.json({ patient, records, appointments, invoices });
});
api.patch('/patients/:id', staff, async (req, res) => {
  const patient = await Patient.findOneAndUpdate({ _id: req.params.id, active: true }, patientInput.partial().parse(req.body), { new: true, runValidators: true });
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  res.json({ patient });
});
api.delete('/patients/:id', admin, async (req, res) => {
  const patient = await Patient.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!patient) return res.status(404).json({ message: 'Patient not found.' });
  res.status(204).end();
});

api.get('/doctors', staff, async (req, res) => {
  const profiles = await Doctor.find({ active: true }).select('user specialization department consultationFee phone qualifications workingHours').populate({ path: 'user', select: 'name email' }).populate('department', 'name');
  const profilesByUser = new Map(profiles.map(profile => [String(profile.user?._id), profile]));
  const usersWithoutProfiles = await User.find({ role: 'doctor', active: true }).select('name email');
  res.json({ items: [...profiles.filter(d => d.user).map(d => ({ _id: d.user._id, profileId: d.id, user: d.user, name: d.user.name, specialization: d.specialization, department: d.department, consultationFee: d.consultationFee, unitPrice: d.consultationFee, phone: d.phone, qualifications: d.qualifications, workingHours: d.workingHours })), ...usersWithoutProfiles.filter(user => !profilesByUser.has(user.id)).map(user => ({ _id: user.id, profileId: null, user, name: user.name, specialization: '', department: null, consultationFee: 0, unitPrice: 0 }))] });
});
api.get('/departments', staff, async (req, res) => {
  await Department.bulkWrite(DEFAULT_DEPARTMENTS.map(name => ({ updateOne: { filter: { name }, update: { $setOnInsert: { name } }, upsert: true } })));
  res.json({ items: await Department.find({ active: true }).sort({ name: 1 }) });
});
api.get('/doctor-options', staff, async (req, res) => res.json({ specializations: SPECIALIZATIONS }));
api.post('/departments', authenticate, admin, async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500).optional() }).parse(req.body);
  res.status(201).json({ department: await Department.create(input) });
});
api.get('/doctors/:id', staff, async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).populate({ path: 'user', select: 'name email active' }).populate('department', 'name');
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found.' });
  res.json({ doctor });
});
api.post('/doctors', authenticate, admin, async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2), email: z.string().email(), password: z.string().min(12), specialization: z.enum(SPECIALIZATIONS), department: z.string().regex(/^[a-f\d]{24}$/i).optional(), qualifications: z.array(z.string()).default([]), consultationFee: z.number().min(0).default(0), phone: z.string().optional(), workingHours: z.array(z.object({ day: z.string(), start: z.string(), end: z.string(), available: z.boolean().default(true) })).default([]) }).parse(req.body);
  if (input.department && !await Department.exists({ _id: input.department, active: true })) return res.status(400).json({ message: 'Choose an active department.' });
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email: input.email, passwordHash, role: 'doctor' });
  const { name, email, password, ...profile } = input;
  const doctor = await Doctor.create({ ...profile, user: user.id });
  res.status(201).json({ doctor: await doctor.populate([{ path: 'user', select: 'name email' }, { path: 'department', select: 'name' }]) });
});
api.patch('/doctors/:id', authenticate, admin, async (req, res) => {
  const input = z.object({ specialization: z.enum(SPECIALIZATIONS).optional(), department: z.string().regex(/^[a-f\d]{24}$/i).optional(), qualifications: z.array(z.string()).optional(), consultationFee: z.number().min(0).optional(), phone: z.string().optional(), workingHours: z.array(z.object({ day: z.string(), start: z.string(), end: z.string(), available: z.boolean() })).optional(), active: z.boolean().optional() }).parse(req.body);
  if (input.department && !await Department.exists({ _id: input.department, active: true })) return res.status(400).json({ message: 'Choose an active department.' });
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true }).populate({ path: 'user', select: 'name email' }).populate('department', 'name');
  if (!doctor) return res.status(404).json({ message: 'Doctor profile not found.' });
  res.json({ doctor });
});
api.get('/pharmacy', allowRoles('admin', 'doctor', 'nurse', 'pharmacist'), async (req, res) => {
  const filter = { active: true };
  if (req.query.q) filter.name = { $regex: String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  res.json({ items: await Medicine.find(filter).sort({ expiryDate: 1 }).limit(200) });
});
api.post('/pharmacy', authenticate, allowRoles('admin', 'pharmacist'), async (req, res) => {
  const input = z.object({ name: z.string().trim().min(1), batchNumber: z.string().trim().min(1), expiryDate: z.coerce.date(), quantity: z.number().int().min(0), reorderLevel: z.number().int().min(0).default(10), unitPrice: z.number().min(0).default(0) }).parse(req.body);
  res.status(201).json({ medicine: await Medicine.create(input) });
});
api.patch('/pharmacy/:id', authenticate, allowRoles('admin', 'pharmacist'), async (req, res) => {
  const input = z.object({ quantity: z.number().int().min(0).optional(), reorderLevel: z.number().int().min(0).optional(), unitPrice: z.number().min(0).optional(), expiryDate: z.coerce.date().optional() }).parse(req.body);
  const medicine = await Medicine.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true });
  if (!medicine) return res.status(404).json({ message: 'Medicine not found.' });
  res.json({ medicine });
});
api.get('/reports/summary', allowRoles('admin', 'receptionist', 'billing', 'doctor'), async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const [patients, appointments, invoiceTotals, auditCount] = await Promise.all([
    Patient.countDocuments({ createdAt: { $gte: from, $lte: to } }),
    Appointment.aggregate([{ $match: { date: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Invoice.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }]),
    AuditLog.countDocuments({ timestamp: { $gte: from, $lte: to } })
  ]);
  res.json({ period: { from, to }, patients, appointments, invoices: invoiceTotals, auditCount });
});
api.get('/reports/audit', admin, async (req, res) => res.json({ items: await AuditLog.find().sort({ timestamp: -1 }).limit(100).populate('actor', 'name email') }));
api.get('/staff', admin, async (req, res) => res.json({ items: await User.find().select('name email role active').sort({ name: 1 }) }));
api.patch('/staff/:id/activate', admin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { active: true }, { new: true }).select('name email role active');
  if (!user) return res.status(404).json({ message: 'Staff account not found.' });
  res.json({ user });
});
api.get('/appointments', staff, async (req, res) => {
  const filter = {};
  if (req.query.from || req.query.to) filter.date = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to) } : {}) };
  if (req.query.status) filter.status = req.query.status;
  const appointments = await Appointment.find(filter).sort({ date: 1 }).populate('patient', 'patientId firstName lastName phone').populate('doctor', 'name');
  res.json({ items: appointments });
});
api.post('/appointments', staff, async (req, res) => {
  const input = z.object({ patient: z.string().min(1), doctor: z.string().min(1), date: z.coerce.date(), reason: z.string().max(500).optional() }).parse(req.body);
  const [patient, doctor] = await Promise.all([Patient.findOne({ _id: input.patient, active: true }), User.findOne({ _id: input.doctor, role: 'doctor', active: true })]);
  if (!patient || !doctor) return res.status(400).json({ message: 'Choose an active patient and doctor.' });
  const appointment = await Appointment.create(input);
  res.status(201).json({ appointment: await appointment.populate([{ path: 'patient', select: 'patientId firstName lastName' }, { path: 'doctor', select: 'name' }]) });
});
api.get('/appointments/:id/receipt.pdf', staff, async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate('patient', 'patientId firstName lastName phone').populate('doctor', 'name');
  if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
  if (!appointment.patient || !appointment.doctor) return res.status(404).json({ message: 'Appointment patient or doctor was not found.' });
  const filename = `appointment-${appointment._id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const document = new PDFDocument({ size: 'A4', margin: 54 });
  document.pipe(res);
  document.fontSize(20).text('Carepoint Hospital');
  document.moveDown(0.4).fontSize(16).text('Appointment confirmation');
  document.moveDown().fontSize(11);
  document.text(`Appointment ID: ${appointment._id}`);
  document.text(`Date and time: ${new Date(appointment.date).toLocaleString('en-IN')}`);
  document.text(`Status: ${appointment.status.replaceAll('_', ' ')}`);
  document.moveDown().fontSize(13).text('Patient', { underline: true });
  document.fontSize(11).text(`${appointment.patient.firstName} ${appointment.patient.lastName}`);
  document.text(`Patient ID: ${appointment.patient.patientId}`);
  if (appointment.patient.phone) document.text(`Phone: ${appointment.patient.phone}`);
  document.moveDown().fontSize(13).text('Care team', { underline: true });
  document.fontSize(11).text(`Doctor: ${appointment.doctor.name}`);
  document.text(`Reason: ${appointment.reason || 'General consultation'}`);
  document.moveDown(2).fontSize(10).text('Please bring this confirmation to your appointment.');
  document.end();
});
api.patch('/appointments/:id', staff, async (req, res) => {
  const input = z.object({ date: z.coerce.date().optional(), reason: z.string().max(500).optional(), status: z.enum(['scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(), notes: z.string().max(3000).optional() }).parse(req.body);
  const appointment = await Appointment.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true }).populate('patient', 'patientId firstName lastName').populate('doctor', 'name');
  if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
  res.json({ appointment });
});

api.get('/records', allowRoles('admin', 'doctor', 'nurse'), async (req, res) => {
  const records = await MedicalRecord.find(req.query.patient ? { patient: req.query.patient } : {}).sort({ visitDate: -1 }).limit(100).populate('patient', 'patientId firstName lastName').populate('doctor', 'name');
  res.json({ items: records });
});
api.patch('/records/:id/status', allowRoles('admin', 'doctor'), async (req, res) => {
  const { status } = z.object({ status: z.enum(['open', 'completed']) }).parse(req.body);
  const record = await MedicalRecord.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!record) return res.status(404).json({ message: 'Medical record not found.' });
  res.json({ record });
});
api.delete('/records/:id', allowRoles('admin', 'doctor'), async (req, res) => {
  const record = await MedicalRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ message: 'Medical record not found.' });
  if (record.status !== 'completed') return res.status(409).json({ message: 'Complete this medical record before removing it.' });
  await record.deleteOne();
  res.status(204).end();
});
api.post('/records', allowRoles('admin', 'doctor'), async (req, res) => {
  const input = z.object({ patient: z.string(), appointment: z.string().optional(), diagnosis: z.string().trim().min(1).max(2000), symptoms: z.string().max(3000).optional(), treatment: z.string().max(3000).optional(), prescription: z.array(z.object({ medication: z.string(), dosage: z.string(), frequency: z.string(), duration: z.string() })).optional(), followUpDate: z.coerce.date().optional(), notes: z.string().max(3000).optional() }).parse(req.body);
  const record = await MedicalRecord.create({ ...input, doctor: req.user.id });
  res.status(201).json({ record });
});
api.get('/invoices', staff, async (req, res) => {
  const filter = req.query.status === 'pending'
    ? { status: { $in: ['unpaid', 'partially_paid'] } }
    : req.query.status ? { status: req.query.status } : {};
  const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(100).populate('patient', 'patientId firstName lastName');
  const paidAmounts = await Payment.aggregate([
    { $match: { invoice: { $in: invoices.map(invoice => invoice._id) }, status: 'completed' } },
    { $group: { _id: '$invoice', amount: { $sum: '$amount' } } }
  ]);
  const paidByInvoice = new Map(paidAmounts.map(payment => [String(payment._id), payment.amount]));
  res.json({ items: invoices.map(invoice => ({ ...invoice.toObject(), balance: Math.max(0, invoice.total - (paidByInvoice.get(String(invoice._id)) || 0)) })) });
});
api.get('/invoices/:id/pdf', staff, async (req, res) => sendInvoicePdf(req.params.id, res));
api.post('/invoices', staff, async (req, res) => {
  if (typeof req.body?.patient !== 'string' || !req.body.patient.trim()) return res.status(400).json({ message: 'Choose a patient before creating the invoice.' });
  const input = z.object({ patient: z.string(), appointment: z.string().optional(), items: z.array(z.object({ description: z.string().trim().min(1), quantity: z.number().int().min(1), unitPrice: z.number().min(0) })).min(1), tax: z.number().min(0).default(0), dueDate: z.coerce.date().optional() }).parse(req.body);
  if (!await Patient.exists({ _id: input.patient, active: true })) return res.status(400).json({ message: 'Choose an active patient.' });
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const invoice = await Invoice.create({ ...input, invoiceNumber: `INV-${randomBytes(5).toString('hex').toUpperCase()}`, subtotal, total: subtotal + input.tax });
  res.status(201).json({ invoice });
});
api.patch('/invoices/:id/payment', staff, async (req, res) => {
  const input = z.object({ status: z.enum(['unpaid', 'partially_paid', 'paid']) }).parse(req.body);
  const invoice = await Invoice.findByIdAndUpdate(req.params.id, { ...input, paidAt: input.status === 'paid' ? new Date() : undefined }, { new: true, runValidators: true });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
  res.json({ invoice });
});
api.post('/invoices/:id/payments', allowRoles('admin', 'billing'), async (req, res) => {
  const input = z.object({
    amount: z.number().positive(),
    method: z.enum(['cash', 'online', 'card', 'bank_transfer', 'insurance', 'other']),
    paymentApp: z.enum(['phonepe', 'google_pay', 'paytm', 'other_upi']).optional(),
    transactionReference: z.string().max(120).optional()
  }).superRefine((payment, context) => {
    if (payment.method === 'online' && !payment.paymentApp) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentApp'], message: 'Choose the app used for the online payment.' });
    }
    if (payment.method !== 'online' && payment.paymentApp) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentApp'], message: 'An app can only be selected for online payments.' });
    }
  }).parse(req.body);
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice || invoice.status === 'void') return res.status(404).json({ message: 'Open invoice not found.' });
  const alreadyPaid = await Payment.aggregate([{ $match: { invoice: invoice._id, status: 'completed' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]);
  const balance = invoice.total - (alreadyPaid[0]?.amount ?? 0);
  if (input.amount > balance) return res.status(400).json({ message: 'Payment amount exceeds the outstanding balance.' });
  const payment = await Payment.create({ ...input, invoice: invoice.id, receivedBy: req.user.id, receiptNumber: `RCPT-${randomBytes(5).toString('hex').toUpperCase()}` });
  const paidTotal = (alreadyPaid[0]?.amount ?? 0) + input.amount;
  invoice.status = paidTotal >= invoice.total ? 'paid' : 'partially_paid';
  if (invoice.status === 'paid') invoice.paidAt = new Date();
  await invoice.save();
  res.status(201).json({ payment, invoice });
});
api.get('/invoices/:id/receipts', staff, async (req, res) => {
  const payments = await Payment.find({ invoice: req.params.id }).sort({ createdAt: -1 }).populate('receivedBy', 'name');
  res.json({ items: payments });
});
api.get('/payments/:id/receipt.pdf', staff, async (req, res) => sendPaymentReceipt(req.params.id, res));
api.post('/payments/:id/refund', allowRoles('admin', 'billing'), async (req, res) => {
  const payment = await Payment.findByIdAndUpdate(req.params.id, { status: 'refunded' }, { new: true, runValidators: true });
  if (!payment) return res.status(404).json({ message: 'Payment not found.' });
  const invoice = await Invoice.findById(payment.invoice);
  if (invoice) {
    const paid = await Payment.aggregate([{ $match: { invoice: invoice._id, status: 'completed' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]);
    invoice.status = (paid[0]?.amount ?? 0) <= 0 ? 'unpaid' : 'partially_paid';
    invoice.paidAt = undefined;
    await invoice.save();
  }
  res.json({ payment, invoice });
});
