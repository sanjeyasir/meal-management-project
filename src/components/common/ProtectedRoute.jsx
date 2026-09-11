import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    // If adminOnly route, redirect to admin login. Otherwise redirect to kiosk
    return <Navigate to={adminOnly ? "/admin/login" : "/kiosk"} state={{ from: location }} replace />;
  }

  if (adminOnly && !currentUser.isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

