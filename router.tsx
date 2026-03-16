import React, { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';

const HomePage = React.lazy(() => import('./pages/HomePage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const ProjectPage = React.lazy(() => import('./pages/ProjectPage'));

const PageFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageFallback />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ProfilePage />
          </Suspense>
        ),
      },
      {
        path: 'admin',
        element: (
          <Suspense fallback={<PageFallback />}>
            <AdminPage />
          </Suspense>
        ),
      },
      {
        path: 'project/:id',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ProjectPage />
          </Suspense>
        ),
      },
    ],
  },
]);
