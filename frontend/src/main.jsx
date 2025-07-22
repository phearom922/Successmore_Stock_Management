import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Warehouses from "./pages/Warehouses";
import Users from "./pages/Users";
import ReceiveHistory from "./pages/ReceiveHistory";
import LotManagement from "./pages/LotManagement";
import ManageDamage from "./pages/ManageDamage";
import Settings from "./pages/Settings";
import StockReports from "./pages/StockReports";
import Suppliers from "./pages/Suppliers";
import IssueStock from "./pages/IssueStock";
import IssueHistory from "./pages/IssueHistory";
import TransferOrder from "./pages/TransferOrder";
import AdjustStock from "./pages/AdjustStock";

// Initial Loading Component
const InitialLoading = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
    <div className="flex flex-col items-center">
      <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-orange-600"></div>
      <p className="mt-4 text-gray-600">Loading application...</p>
    </div>
  </div>
);

// UnauthorizedToast Component
const UnauthorizedToast = () => {
  const location = useLocation();
  const state = location.state;

  useEffect(() => {
    if (state?.message) {
      toast[state.type || "error"](state.message, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [state]);

  return null;
};

// AuthChecker Component
const AuthChecker = ({
  children,
  requiredRoles = [],
  requiredPermissions = [],
}) => {
  const [authState, setAuthState] = useState({
    loading: true,
    isAuthorized: false,
    redirect: null,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setAuthState({
            loading: false,
            isAuthorized: false,
            redirect: (
              <Navigate
                to="/login"
                replace
                state={{
                  message: "Please login to continue",
                  type: "info",
                }}
              />
            ),
          });
          return;
        }

        // Decode token without verification (for demo)
        // In production, you should verify the token with your backend
        const payload = JSON.parse(atob(token.split(".")[1]));

        // Check token expiration
        if (payload.exp * 1000 < Date.now()) {
          localStorage.removeItem("token");
          setAuthState({
            loading: false,
            isAuthorized: false,
            redirect: (
              <Navigate
                to="/login"
                replace
                state={{
                  message: "រយៈពេលត្រូវបានផុត​កំណត់​ សូមចូលម្តងទៀត.",
                  type: "warning",
                }}
              />
            ),
          });
          return;
        }

        const userRole = payload.role;
        const userPermissions = payload.permissions || [];

        // Check Permissions
        if (requiredPermissions.length > 0) {
          const hasPermission = requiredPermissions.every((perm) => {
            const featurePerm = userPermissions.find(
              (p) => p.feature === perm.feature,
            );
            if (!featurePerm) return false;
            if (!perm.permissions || perm.permissions.length === 0) return true;
            return perm.permissions.every((p) =>
              featurePerm.permissions.includes(p),
            );
          });

          if (!hasPermission) {
            setAuthState({
              loading: false,
              isAuthorized: false,
              redirect: (
                <Navigate
                  to="/"
                  replace
                  state={{
                    message: "You don't have permission to access this page",
                    type: "error",
                  }}
                />
              ),
            });
            return;
          }
        }

        // Check Roles
        if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
          setAuthState({
            loading: false,
            isAuthorized: false,
            redirect: (
              <Navigate
                to="/"
                replace
                state={{
                  message: "Access denied. Insufficient privileges.",
                  type: "error",
                }}
              />
            ),
          });
          return;
        }

        // All checks passed
        setAuthState({
          loading: false,
          isAuthorized: true,
          redirect: null,
        });
      } catch (error) {
        console.error("Authentication check failed:", error);
        localStorage.removeItem("token");
        setAuthState({
          loading: false,
          isAuthorized: false,
          redirect: (
            <Navigate
              to="/login"
              replace
              state={{
                message: "Invalid session. Please login again.",
                type: "error",
              }}
            />
          ),
        });
      }
    };

    checkAuth();
  }, [requiredRoles, requiredPermissions]);

  if (authState.loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100/50">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (authState.redirect) return authState.redirect;

  return authState.isAuthorized ? (
    <>
      <UnauthorizedToast />
      {children}
    </>
  ) : null;
};

// ErrorBoundary Component
const ErrorBoundary = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-100">
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-bold text-red-600">Error</h2>
      <p className="text-gray-600">
        Something went wrong. Please try again or contact support.
      </p>
    </div>
  </div>
);

// AppWrapper Component to handle initial loading
const AppWrapper = () => {
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    // Simulate initial app loading
    const timer = setTimeout(() => {
      setAppLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (appLoading) {
    return <InitialLoading />;
  }

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<App />}>
          <Route
            index
            element={
              <AuthChecker requiredRoles={["admin", "user"]}>
                <Dashboard />
              </AuthChecker>
            }
          />
          <Route
            path="/users"
            element={
              <AuthChecker requiredRoles={["admin"]}>
                <Users />
              </AuthChecker>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthChecker requiredRoles={["admin"]}>
                <Settings />
              </AuthChecker>
            }
          />
          <Route
            path="/categories"
            element={
              <AuthChecker
                requiredPermissions={[
                  { feature: "category", permissions: ["Show"] },
                ]}
              >
                <Categories />
              </AuthChecker>
            }
          />
          <Route
            path="/products"
            element={
              <AuthChecker
                requiredPermissions={[
                  { feature: "products", permissions: ["Show"] },
                ]}
              >
                <Products />
              </AuthChecker>
            }
          />
          <Route
            path="/warehouses"
            element={
              <AuthChecker requiredRoles={["admin"]}>
                <Warehouses />
              </AuthChecker>
            }
          />
          <Route
            path="/receive-history"
            element={
              <AuthChecker requiredRoles={["admin", "user"]}>
                <ReceiveHistory />
              </AuthChecker>
            }
          />
          <Route
            path="/lot-management"
            element={
              <AuthChecker
                requiredPermissions={[
                  { feature: "lotManagement", permissions: ["Show"] },
                ]}
              >
                <LotManagement />
              </AuthChecker>
            }
          />
          <Route
            path="/manage-damage"
            element={
              <AuthChecker
                requiredPermissions={[
                  { feature: "manageDamage", permissions: ["Show"] },
                ]}
              >
                <ManageDamage />
              </AuthChecker>
            }
          />
          <Route
            path="/stock-reports"
            element={
              <AuthChecker requiredRoles={["admin", "user"]}>
                <StockReports />
              </AuthChecker>
            }
          />
          <Route
            path="/suppliers"
            element={
              <AuthChecker requiredRoles={["admin", "user"]}>
                <Suppliers />
              </AuthChecker>
            }
          />
          <Route
            path="/issue-stock"
            element={
              <AuthChecker requiredRoles={["admin", "user"]}>
                <IssueStock />
              </AuthChecker>
            }
          />
          <Route
            path="/issue-history"
            element={
              <AuthChecker requiredRoles={["admin", "user"]}>
                <IssueHistory />
              </AuthChecker>
            }
          />
          <Route
            path="/transfer-order"
            element={
              <AuthChecker requiredRoles={["admin", "user"]}>
                <TransferOrder />
              </AuthChecker>
            }
          />
          <Route
            path="/adjust-stock"
            element={
              <AuthChecker requiredRoles={["admin"]}>
                <AdjustStock />
              </AuthChecker>
            }
          />
          <Route path="*" element={<ErrorBoundary />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
};

// Main App Render
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
);
