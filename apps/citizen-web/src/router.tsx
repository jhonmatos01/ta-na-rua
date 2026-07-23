import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { RouteLoadingFallback } from './components/route-loading-fallback';
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
      {
        path: '/mapa',
        hydrateFallbackElement: <RouteLoadingFallback />,
        lazy: async () => {
          const module = await import('./pages/map-page');
          return { Component: module.MapPage };
        },
      },
      {
        path: '/ocorrencias/:occurrenceId',
        hydrateFallbackElement: <RouteLoadingFallback />,
        lazy: async () => {
          const module = await import('./pages/occurrence-detail-page');
          return { Component: module.OccurrenceDetailPage };
        },
      },
      { path: '/status', element: <StatusPage /> },
      { path: '/indisponivel', element: <UnavailablePage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/perfil', element: <ProfilePage /> },
          {
            path: '/minhas-ocorrencias',
            hydrateFallbackElement: <RouteLoadingFallback />,
            lazy: async () => {
              const module = await import('./pages/account-occurrences-page');
              return { Component: module.AccountOccurrencesPage };
            },
          },
          {
            path: '/notificacoes',
            hydrateFallbackElement: <RouteLoadingFallback />,
            lazy: async () => {
              const module = await import('./pages/notifications-page');
              return { Component: module.NotificationsPage };
            },
          },
          {
            path: '/nova-ocorrencia',
            hydrateFallbackElement: <RouteLoadingFallback />,
            lazy: async () => {
              const module = await import('./pages/new-occurrence-page');
              return { Component: module.NewOccurrencePage };
            },
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
