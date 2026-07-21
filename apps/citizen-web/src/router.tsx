import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppLayout } from './layouts/app-layout';
import { HomePage } from './pages/home-page';
import { NotFoundPage } from './pages/not-found-page';
import { StatusPage } from './pages/status-page';
import { UnavailablePage } from './pages/unavailable-page';

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/status', element: <StatusPage /> },
      { path: '/indisponivel', element: <UnavailablePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
