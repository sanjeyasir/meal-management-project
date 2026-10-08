import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/common/ProtectedRoute";
import AppLayout from "../components/layout/AppLayout";

// Pages
import Login from "../pages/auth/Login";
import AnalyticsDashboard from "../pages/admin/AnalyticsDashboard";
import ReportsPage from "../pages/admin/ReportsPage";
import DailyArchivedReportsPage from "../pages/admin/DailyArchivedReportsPage";
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
      {/* Default Route & Login */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<Login />} />

      {/* Redirect old /kiosk routes to Dashboard */}
      <Route path="/kiosk" element={<Navigate to="/admin/dashboard" replace />} />

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
        path="/admin/daily-archive"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <DailyArchivedReportsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/archived-reports"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <DailyArchivedReportsPage />
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

      {/* Meal Ordering & Dispensing Portal */}
      <Route
        path="/meals/order"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MealOrderPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meals/confirm-order"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MealConfirmOrderPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meals/receive"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MealReceivePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meals/my-allocations"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MyMealAllocationsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Default Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
