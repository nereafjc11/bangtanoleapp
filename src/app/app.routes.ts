
import { Routes } from '@angular/router';

export const routes: Routes = [

  {
    path: 'auth/login',
    loadComponent: () =>
      import('./pages/login/login')
        .then(m => m.Login)
  },

  {
    path: 'auth/register',
    loadComponent: () =>
      import('./pages/register/register')
        .then(m => m.Register)
  },

 {
  path: 'home',
  loadComponent: () =>
    import('./pages/home/home')
      .then(m => m.Home)
},

  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },

  {
    path: '**',
    redirectTo: 'auth/login'
  }

];
