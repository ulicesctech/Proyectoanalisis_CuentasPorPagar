// client/src/app/App.tsx
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';
import { AuthProvider } from '../modules/cxp/auth/session';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <div className="erp-app min-h-screen bg-slate-50">
      <AuthProvider><RouterProvider router={router} /></AuthProvider>
    </div>
  );
}
