// client/src/app/App.tsx
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <div className="erp-app min-h-screen bg-slate-50">
      <RouterProvider router={router} />
    </div>
  );
}