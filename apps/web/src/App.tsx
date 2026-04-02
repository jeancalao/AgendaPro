// Componente raiz — define roteamento e providers globais
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute }       from './components/auth/PrivateRoute';
import { DashboardLayout }    from './components/dashboard/DashboardLayout';
import { LoginPage }          from './pages/auth/LoginPage';
import { RegisterPage }       from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { DashboardPage }      from './pages/dashboard/DashboardPage';
import { CalendarPage }       from './pages/dashboard/CalendarPage';
import { AppointmentsPage }   from './pages/dashboard/AppointmentsPage';
import { ClientsPage }        from './pages/dashboard/ClientsPage';
import { ClientProfilePage }  from './pages/dashboard/ClientProfilePage';
import { ServicesPage }       from './pages/dashboard/ServicesPage';
import { AvailabilityPage }   from './pages/dashboard/AvailabilityPage';
import { BookingPage }        from './pages/public/BookingPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,      // 1 minuto
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Rotas privadas — PrivateRoute protege, DashboardLayout fornece o shell */}
          <Route element={<PrivateRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard"              element={<DashboardPage />} />
              <Route path="/dashboard/calendar"     element={<CalendarPage />} />
              <Route path="/dashboard/appointments" element={<AppointmentsPage />} />
              <Route path="/dashboard/clients"      element={<ClientsPage />} />
              <Route path="/dashboard/clients/:id"  element={<ClientProfilePage />} />
              <Route path="/dashboard/services"     element={<ServicesPage />} />
              <Route path="/dashboard/availability" element={<AvailabilityPage />} />
            </Route>
          </Route>

          {/* Página pública de agendamento — acessível sem login */}
          <Route path="/:slug" element={<BookingPage />} />

          {/* Redirect raiz */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
