import React, { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const LitClubPage = lazy(() => import('./pages/LitClubPage'));
const WritingPage = lazy(() => import('./pages/WritingPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));

const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 border-3 border-neutral-200 border-t-amber-500 rounded-full animate-spin" />
    <span className="text-xs font-medium text-neutral-400 animate-pulse">Loading GoBoard...</span>
  </div>
);

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: withSuspense(LandingPage),
  },
  {
    path: '/welcome',
    element: withSuspense(WelcomePage),
  },
  {
    element: <App />,
    children: [
      {
        path: 'browse',
        element: withSuspense(HomePage),
      },
      {
        path: 'profile',
        element: withSuspense(ProfilePage),
      },
      {
        path: 'admin',
        element: withSuspense(AdminPage),
      },
      {
        path: 'project/:id',
        element: withSuspense(ProjectPage),
      },
      {
        path: 'lit-club',
        element: withSuspense(LitClubPage),
      },
      {
        path: 'writing/:id',
        element: withSuspense(WritingPage),
      },
    ],
  },
]);
