import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const roleGuard: CanActivateFn = route => {
  const roles = route.data['roles'] as string[] | undefined;
  if (!roles?.length) return true;
  let user: { role?: string } = {};
  try { user = JSON.parse(localStorage.getItem('carepoint_user') || '{}') as { role?: string }; } catch { /* malformed browser state is denied */ }
  return roles.includes(user.role || '') ? true : inject(Router).parseUrl('/');
};
