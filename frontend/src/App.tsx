import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Portfolio from './pages/Portfolio';
import Positions from './pages/Positions';
import Orders from './pages/Orders';
import TradeHistory from './pages/TradeHistory';
import Trading from './pages/Trading';
import Exchanges from './pages/Exchanges';
import Alerts from './pages/Alerts';

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/trades" element={<TradeHistory />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/exchanges" element={<Exchanges />} />
        <Route path="/alerts" element={<Alerts />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
