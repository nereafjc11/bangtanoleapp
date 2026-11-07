
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./pages/login/login').then((m) => m.Login),
    data: { mode: 'login' },
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./pages/login/login').then((m) => m.Login),
    data: { mode: 'register' },
  },
  {
    path: 'preferences',
    loadComponent: () =>
      import('./pages/preferences/preferences').then(
        (m) => m.Preferences
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout').then(
        (m) => m.MainLayout
      ),
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home').then((m) => m.Home),
      },
      {
        path: 'explorar',
        loadComponent: () =>
          import('./pages/explorar/explorar').then(
            (m) => m.Explorar
          ),
      },
      {
        path: 'contenido/:type/:id',
        loadComponent: () =>
          import('./pages/contenido-detalle/contenido-detalle')
            .then((m) => m.ContenidoDetalle),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile').then(
            (m) => m.Profile
          ),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
