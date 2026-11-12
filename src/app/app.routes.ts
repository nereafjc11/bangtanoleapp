import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    data: { mode: 'login' },
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    data: { mode: 'register' },
  },
  {
    path: 'preferences',
    loadComponent: () => import('./pages/preferences/preferences').then((m) => m.Preferences),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home').then((m) => m.Home),
      },
      {
        path: 'explorar',
        loadComponent: () => import('./pages/explorar/explorar').then((m) => m.Explorar),
      },
      {
        path: 'peliculas-series',
        loadComponent: () =>
          import('./pages/peliculas-series/peliculas-series').then((m) => m.PeliculasSeries),
      },
      {
        path: 'contenido/:type/:id',
        loadComponent: () =>
          import('./pages/contenido-detalle/contenido-detalle').then((m) => m.ContenidoDetalle),
      },
      {
        path: 'profile/:id',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'listas',
        loadComponent: () => import('./pages/listas/listas').then((m) => m.Listas),
      },
      {
        path: 'favoritos',
        loadComponent: () => import('./pages/favoritos/favoritos').then((m) => m.Favoritos),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'peliculas-series/anadir',
        loadComponent: () => import('./pages/anadir-ficha/anadir-ficha').then((m) => m.AnadirFicha),
      },
      {
        path: 'ficha-comunidad/:id',
        loadComponent: () =>
          import('./pages/ficha-comunidad/ficha-comunidad').then((m) => m.FichaComunidad),
      },
      {
  path: 'catalogo-dinamico/:categoria',
  loadComponent: () =>
    import('./pages/catalogo-dinamico/catalogo-dinamico')
      .then(m => m.CatalogoDinamico)
}
    ],
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
