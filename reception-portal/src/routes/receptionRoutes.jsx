/**
 * receptionRoutes.jsx
 *
 * Drop this into your existing App.jsx router.
 *
 * Usage in App.jsx:
 *
 *   import { receptionRoutes } from "./routes/receptionRoutes";
 *
 *   <Routes>
 *     {receptionRoutes}
 *     {/* ... other portal routes ... *\/}
 *   </Routes>
 */
import { Route, Navigate } from "react-router-dom";
import ReceptionLayout from "../pages/ReceptionLayout";
import CheckInPage from "../pages/CheckInPage";
import QueueBoardPage from "../pages/QueueBoardPage";
import TodaysAppointmentsPage from "../pages/TodaysAppointmentsPage";
import LoginPage from "../pages/LoginPage";
import ProtectedRoute from "./ProtectedRoute";

export const receptionRoutes = (
  <>
    <Route path="/login" element={<LoginPage />} />

    <Route
      path="/reception"
      element={
        <ProtectedRoute allowedRoles={["receptionist", "nurse", "admin"]}>
          <ReceptionLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/reception/checkin" replace />} />
      <Route path="checkin" element={<CheckInPage />} />
      <Route path="queue" element={<QueueBoardPage />} />
      <Route path="appointments" element={<TodaysAppointmentsPage />} />
    </Route>

    {/* Redirect old /staff-portal root if it exists */}
    <Route path="/staff-portal/reception/*" element={<Navigate to="/reception" replace />} />
  </>
);
