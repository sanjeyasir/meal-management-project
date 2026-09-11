import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/common/ProtectedRoute";
import AppLayout from "../components/layout/AppLayout";
import KioskLayout from "../components/layout/KioskLayout";

// Pages
import CanteenKiosk from "../pages/kiosk/CanteenKiosk";
import Login from "../pages/auth/Login";
import AnalyticsDashboard from "../pages/admin/AnalyticsDashboard";
import ReportsPage from "../pages/admin/ReportsPage";
import AllAllocationsPage from "../pages/admin/AllAllocationsPage";
import AllocationsEditPage from "../pages/admin/AllocationsEditPage";
import EmployeesPage from "../pages/admin/EmployeesPage";
import SettingsPage from "../pages/admin/SettingsPage";

import MealOrderPage from "../pages/meals/MealOrderPage";
import MealConfirmOrderPage from "../pages/meals/MealConfirmOrderPage";
import MealReceivePage from "../pages/meals/MealReceivePage";
import MyMealAllocationsPage from "../pages/meals/MyMealAllocationsPage";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Default Canteen Kiosk (No admin login needed, uses biometrics & autocomplete search) */}
      <Route path="/" element={<CanteenKiosk />} />
      <Route path="/kiosk" element={<CanteenKiosk />} />

      {/* Admin Login (Clean Credentials Only) */}
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<Login />} />

      {/* Admin Protected Management Portal */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <AnalyticsDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <AnalyticsDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/allocations-edit"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <AllocationsEditPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <ReportsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/all-allocations"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <AllAllocationsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/employees"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <EmployeesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Employee Ordering & Dispensing (Uses Kiosk aesthetic, NO admin sidebar) */}
      <Route
        path="/meals/order"
        element={
          <ProtectedRoute>
            <KioskLayout>
              <MealOrderPage />
            </KioskLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meals/confirm-order"
        element={
          <ProtectedRoute>
            <KioskLayout>
              <MealConfirmOrderPage />
            </KioskLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meals/receive"
        element={
          <ProtectedRoute>
            <KioskLayout>
              <MealReceivePage />
            </KioskLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meals/my-allocations"
        element={
          <ProtectedRoute>
            <KioskLayout>
              <MyMealAllocationsPage />
            </KioskLayout>
          </ProtectedRoute>
        }
      />

      {/* Default Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


