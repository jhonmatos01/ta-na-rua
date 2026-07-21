import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppLayout } from './layouts/app-layout';
import { ProtectedRoute } from './features/auth/protected-route';
import { HomePage } from './pages/home-page';
import { LoginPage } from './pages/login-page';
import { NotFoundPage } from './pages/not-found-page';
import { ProfilePage } from './pages/profile-page';
import { RegisterPage } from './pages/register-page';
import { StatusPage } from './pages/status-page';
import { UnavailablePage } from './pages/unavailable-page';

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/entrar', element: <LoginPage /> },
      { path: '/criar-conta', element: <RegisterPage /> },
      { path: '/status', element: <StatusPage /> },
      { path: '/indisponivel', element: <UnavailablePage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/perfil', element: <ProfilePage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
