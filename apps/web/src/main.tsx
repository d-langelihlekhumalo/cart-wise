import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { RedirectIfSignedIn, RequireAuth, RequireOnboarded } from './components/guards';
import { AppLayout, AuthLayout, PublicLayout } from './components/Layout';
import { Spinner } from './components/ui';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ApiRequestError } from './lib/api';
import { OnboardingPage, SettingsPage } from './routes/app';
import { LoginPage, SignupPage } from './routes/auth';
import { NotFoundPage, PrivacyPage } from './routes/static';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Client errors (401, 404, validation) won't fix themselves on retry.
      retry: (failureCount, error) =>
        !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});

const router = createBrowserRouter([
  {
    // Shown while a lazily loaded route is fetched on first page load.
    HydrateFallback: Spinner,
    children: [
      {
        Component: PublicLayout,
        children: [
          { path: 'privacy', Component: PrivacyPage },
          { path: '*', Component: NotFoundPage },
        ],
      },
      {
        Component: RedirectIfSignedIn,
        children: [
          {
            Component: AuthLayout,
            children: [
              { path: 'login', Component: LoginPage },
              { path: 'signup', Component: SignupPage },
            ],
          },
        ],
      },
      {
        Component: RequireAuth,
        children: [
          { Component: AuthLayout, children: [{ path: 'onboarding', Component: OnboardingPage }] },
          {
            Component: RequireOnboarded,
            children: [
              {
                Component: AppLayout,
                children: [
                  // Lists need IndexedDB (Dexie); load those routes on demand.
                  { index: true, lazy: () => import('./features/lists/HomePage') },
                  { path: 'lists', lazy: () => import('./features/lists/ListsPage') },
                  { path: 'lists/:listId', lazy: () => import('./features/lists/ListDetailPage') },
                  { path: 'prices', lazy: () => import('./features/prices/PricesPage') },
                  { path: 'prices/new', lazy: () => import('./features/prices/LogPricePage') },
                  {
                    path: 'products/:productId',
                    lazy: () => import('./features/prices/ProductPage'),
                  },
                  { path: 'settings', Component: SettingsPage },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </QueryClientProvider>
  </StrictMode>,
);
