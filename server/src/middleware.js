import jwt from 'jsonwebtoken';
import { User } from './models.js';

export async function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('name email role active');
    if (!user?.active) return res.status(401).json({ message: 'Account is unavailable.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session.' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'You do not have permission to perform this action.' });
}

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  if (error?.code === 11000) return res.status(409).json({ message: 'A record with that value already exists.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ message: 'Please check the submitted information.', details: error.message });
  }
  if (error?.name === 'ZodError') return res.status(400).json({ message: 'Please check the submitted information.', details: error.issues });
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
