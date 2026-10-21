import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { LoginComponent } from './pages/login.component';
import { DashboardComponent } from './pages/dashboard.component';
import { PatientsComponent } from './pages/patients.component';
import { ScheduleComponent } from './pages/schedule.component';
import { WorkspaceComponent } from './pages/workspace.component';
import { PatientDetailComponent } from './pages/patient-detail.component';
import { SignupComponent } from './pages/signup.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: '', component: AppShellComponent, canActivate: [authGuard], children: [
    { path: '', component: DashboardComponent, title: 'Overview · Carepoint' },
    { path: 'patients', component: PatientsComponent, title: 'Patients · Carepoint' },
    { path: 'patients/:id', component: PatientDetailComponent, title: 'Patient profile · Carepoint' },
    { path: 'appointments', component: ScheduleComponent, title: 'Appointments · Carepoint' },
    { path: 'doctors', component: WorkspaceComponent, canActivate: [roleGuard], data: { kind: 'doctors', roles: ['admin', 'doctor', 'receptionist'] }, title: 'Doctors · Carepoint' },
    { path: 'records', component: WorkspaceComponent, canActivate: [roleGuard], data: { kind: 'records', roles: ['admin', 'doctor', 'nurse'] }, title: 'Medical records · Carepoint' },
    { path: 'billing', component: WorkspaceComponent, canActivate: [roleGuard], data: { kind: 'billing', roles: ['admin', 'billing'] }, title: 'Billing · Carepoint' },
    { path: 'pharmacy', component: WorkspaceComponent, canActivate: [roleGuard], data: { kind: 'pharmacy', roles: ['admin', 'pharmacist', 'nurse'] }, title: 'Pharmacy · Carepoint' },
    { path: 'reports', component: WorkspaceComponent, canActivate: [roleGuard], data: { kind: 'reports', roles: ['admin', 'receptionist', 'billing', 'doctor'] }, title: 'Reports · Carepoint' },
    { path: 'staff', component: WorkspaceComponent, canActivate: [roleGuard], data: { kind: 'staff', roles: ['admin'] }, title: 'Care team · Carepoint' }
  ]},
  { path: '**', redirectTo: '' }
];
