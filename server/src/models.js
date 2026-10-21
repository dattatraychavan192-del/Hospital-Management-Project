import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const options = { timestamps: true, versionKey: false };

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'doctor', 'receptionist', 'nurse', 'billing', 'pharmacist'], default: 'receptionist' },
  active: { type: Boolean, default: true }
}, options);

const patientSchema = new Schema({
  patientId: { type: String, unique: true, index: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['female', 'male', 'other', 'prefer_not_to_say'], required: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  address: { type: String, trim: true },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'], default: 'unknown' },
  allergies: [{ type: String, trim: true }],
  emergencyContact: { name: String, phone: String, relationship: String },
  notes: { type: String, trim: true },
  active: { type: Boolean, default: true }
}, options);

const appointmentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  reason: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'], default: 'scheduled', index: true },
  notes: { type: String, trim: true }
}, options);
appointmentSchema.index({ doctor: 1, date: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['scheduled', 'checked_in', 'in_progress'] } } });

const medicalRecordSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  visitDate: { type: Date, default: Date.now },
  diagnosis: { type: String, required: true, trim: true },
  symptoms: { type: String, trim: true },
  treatment: { type: String, trim: true },
  prescription: [{ medication: String, dosage: String, frequency: String, duration: String }],
  followUpDate: Date,
  status: { type: String, enum: ['open', 'completed'], default: 'open', index: true },
  notes: { type: String, trim: true }
}, options);

const invoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  items: [{ description: { type: String, required: true }, quantity: { type: Number, min: 1, default: 1 }, unitPrice: { type: Number, min: 0, required: true } }],
  subtotal: { type: Number, min: 0, required: true },
  tax: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, required: true },
  status: { type: String, enum: ['unpaid', 'partially_paid', 'paid', 'void'], default: 'unpaid', index: true },
  dueDate: Date,
  paidAt: Date
}, options);

const departmentSchema = new Schema({
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String, trim: true },
  active: { type: Boolean, default: true }
}, options);

export const SPECIALIZATIONS = [
  'Anesthesiology', 'Cardiology', 'Dentistry', 'Dermatology', 'Emergency Medicine',
  'Endocrinology', 'Family Medicine', 'Gastroenterology', 'General Practice',
  'General Surgery', 'Geriatrics', 'Hematology', 'Infectious Disease', 'Internal Medicine',
  'Nephrology', 'Neurology', 'Neurosurgery', 'Obstetrics & Gynecology', 'Oncology',
  'Ophthalmology', 'Orthopedics', 'Otolaryngology (ENT)', 'Pediatrics', 'Psychiatry',
  'Pulmonology', 'Radiology', 'Rheumatology', 'Urology'
];

export const DEFAULT_DEPARTMENTS = [
  'Cardiology', 'Dermatology', 'Emergency Medicine', 'General Medicine', 'Gynecology',
  'Neurology', 'Oncology', 'Ophthalmology', 'Orthopedics', 'Pediatrics', 'Psychiatry',
  'Radiology', 'Surgery', 'Urology'
];

const doctorSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  qualifications: [{ type: String, trim: true }],
  specialization: { type: String, required: true, enum: SPECIALIZATIONS },
  department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
  consultationFee: { type: Number, min: 0, default: 0 },
  phone: { type: String, trim: true },
  workingHours: [{ day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }, start: String, end: String, available: { type: Boolean, default: true } }],
  active: { type: Boolean, default: true }
}, options);

const medicineSchema = new Schema({
  name: { type: String, required: true, trim: true, index: true },
  batchNumber: { type: String, required: true, trim: true },
  expiryDate: { type: Date, required: true, index: true },
  quantity: { type: Number, min: 0, required: true, default: 0 },
  reorderLevel: { type: Number, min: 0, default: 10 },
  unitPrice: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true }
}, options);
medicineSchema.index({ name: 1, batchNumber: 1 }, { unique: true });

const paymentSchema = new Schema({
  invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  amount: { type: Number, min: 0.01, required: true },
  method: { type: String, enum: ['cash', 'online', 'card', 'bank_transfer', 'insurance', 'other'], required: true },
  paymentApp: { type: String, enum: ['phonepe', 'google_pay', 'paytm', 'other_upi'] },
  transactionReference: { type: String, trim: true },
  status: { type: String, enum: ['completed', 'refunded', 'failed'], default: 'completed' },
  receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiptNumber: { type: String, unique: true, required: true }
}, options);

const auditLogSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true },
  resourceId: { type: String },
  method: { type: String },
  timestamp: { type: Date, default: Date.now, index: true }
}, { ...options, timestamps: false });

export const User = mongoose.models.User || model('User', userSchema);
export const Patient = mongoose.models.Patient || model('Patient', patientSchema);
export const Appointment = mongoose.models.Appointment || model('Appointment', appointmentSchema);
export const MedicalRecord = mongoose.models.MedicalRecord || model('MedicalRecord', medicalRecordSchema);
export const Invoice = mongoose.models.Invoice || model('Invoice', invoiceSchema);
export const Department = mongoose.models.Department || model('Department', departmentSchema);
export const Doctor = mongoose.models.Doctor || model('Doctor', doctorSchema);
export const Medicine = mongoose.models.Medicine || model('Medicine', medicineSchema);
export const Payment = mongoose.models.Payment || model('Payment', paymentSchema);
export const AuditLog = mongoose.models.AuditLog || model('AuditLog', auditLogSchema);
