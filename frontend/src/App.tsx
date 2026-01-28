import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Portfolio from './pages/Portfolio';
import Positions from './pages/Positions';
import Orders from './pages/Orders';
import TradeHistory from './pages/TradeHistory';
import Trading from './pages/Trading';
import Exchanges from './pages/Exchanges';
import Alerts from './pages/Alerts';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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
    </BrowserRouter>
  );
}

export default App;
