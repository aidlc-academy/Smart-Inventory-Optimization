import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AddProductPage from './pages/AddProductPage';
import DailySalesPage from './pages/DailySalesPage';
import DashboardPage from './pages/DashboardPage';
import EditProductPage from './pages/EditProductPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import OrdersPage from './pages/OrdersPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public auth routes — full-page, no sidebar */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected inventory routes — need session + onboarding */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/"                   element={<HomePage />} />
            <Route path="/stock-planning"     element={<DashboardPage />} />
            <Route path="/daily-sales"        element={<DailySalesPage />} />
            <Route path="/orders"             element={<OrdersPage />} />
            <Route path="/products/new"       element={<AddProductPage />} />
            <Route path="/products/:id"       element={<ProductDetailPage />} />
            <Route path="/products/:id/edit"  element={<EditProductPage />} />
            <Route path="/profile"            element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
