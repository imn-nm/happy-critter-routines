import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import AuthProvider from "@/components/AuthProvider";
import ImportantTaskNotifier from "@/components/ImportantTaskNotifier";
import RewardRequestNotifier from "@/components/RewardRequestNotifier";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ChildSetup from "./pages/ChildSetup";
import ParentSettings from "./pages/ParentSettings";
import ChildInterface from "./pages/ChildInterface";
import ChildDashboard from "./pages/ChildDashboard";
import TaskManagement from "./pages/TaskManagement";
import NotFound from "./pages/NotFound";
import ChildNameGate from "./pages/ChildNameGate";
import ChecklistPreview from "./pages/ChecklistPreview";
import ChorePreview from "./pages/ChorePreview";
import ChildOverduePreview from "./pages/ChildOverduePreview";
import ChildOverdueSubtasksPreview from "./pages/ChildOverdueSubtasksPreview";
import ChildOverdueSubtasksCompactPreview from "./pages/ChildOverdueSubtasksCompactPreview";
import AnimationsPreview from "./pages/AnimationsPreview";
import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";

const ReportsRedirect = () => {
  const { childId } = useParams();
  return <Navigate to={`/child-dashboard/${childId}`} replace />;
};

const queryClient = new QueryClient();

const ProtectedRoutes = () => (
  <Routes>
    <Route path="/" element={<ChildNameGate />} />
    <Route path="/landing" element={<Index />} />
    <Route path="/dashboard" element={<Navigate to="/parent" replace />} />
    <Route path="/parent" element={<Dashboard />} />
    <Route path="/setup" element={<ChildSetup />} />
    <Route path="/settings" element={<ParentSettings />} />
    <Route path="/child/:childId" element={<ChildInterface />} />
    <Route path="/child-dashboard/:childId" element={<ChildDashboard />} />
    <Route path="/tasks" element={<TaskManagement />} />
    <Route path="/reports/:childId" element={<ReportsRedirect />} />
    <Route path="/preview/checklist" element={<ChecklistPreview />} />
    <Route path="/preview/chore" element={<ChorePreview />} />
    <Route path="/preview/overdue" element={<ChildOverduePreview />} />
    <Route path="/preview/overdue-subtasks" element={<ChildOverdueSubtasksPreview />} />
    <Route path="/preview/overdue-subtasks-compact" element={<ChildOverdueSubtasksCompactPreview />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes — outside AuthProvider so unauth'd users can reach them. */}
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/preview/animations" element={<AnimationsPreview />} />
          <Route
            path="*"
            element={
              <AuthProvider>
                <ImportantTaskNotifier />
                <RewardRequestNotifier />
                <ProtectedRoutes />
              </AuthProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
