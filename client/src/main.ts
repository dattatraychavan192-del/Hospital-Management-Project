import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors([authInterceptor])), provideAnimations()]
}).catch((error: unknown) => console.error(error));
