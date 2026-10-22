import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import ProjectPage from './pages/ProjectPage';
import LitClubPage from './pages/LitClubPage';
import WritingPage from './pages/WritingPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    element: <App />,
    children: [
      {
        path: 'browse',
        element: <HomePage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'admin',
        element: <AdminPage />,
      },
      {
        path: 'project/:id',
        element: <ProjectPage />,
      },
      {
        path: 'lit-club',
        element: <LitClubPage />,
      },
      {
        path: 'writing/:id',
        element: <WritingPage />,
      },
    ],
  },
]);

