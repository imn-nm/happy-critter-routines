import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthProvider from "@/components/AuthProvider";
import ParentGate from "@/components/ParentGate";
import ImportantTaskNotifier from "@/components/ImportantTaskNotifier";
import RewardRequestNotifier from "@/components/RewardRequestNotifier";
import MissedImportantNotifier from "@/components/MissedImportantNotifier";
import RealtimeQuerySync from "@/components/RealtimeQuerySync";
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
import CrittersPreview from "./pages/CrittersPreview";
import SpritePetPreview from "./pages/SpritePetPreview";
import PlaytimePreview from "./pages/PlaytimePreview";
import CritterEditor from "./pages/CritterEditor";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";
import { Toaster as Sonner } from "@/components/ui/sonner";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import TimeReservePreview from "./pages/TimeReservePreview";
import { MotionConfig } from "motion/react";

// Design/preview tool pages only exist in local dev builds. They are never
// linked from the app and must not ship to the deployed site.
const DEV_TOOLS = import.meta.env.DEV;

const queryClient = new QueryClient();

// Grown-up alerts ("…hasn't finished Homework", "…wants a reward!"). The
// child's screen runs inside the same signed-in app, so these stay off it.
const ParentNotifiers = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/child/")) return null;
  return (
    <>
      <ImportantTaskNotifier />
      <RewardRequestNotifier />
      <MissedImportantNotifier />
    </>
  );
};

const ProtectedRoutes = () => (
  <Routes>
    <Route path="/" element={<ChildNameGate />} />
    <Route path="/landing" element={<Index />} />
    <Route path="/dashboard" element={<Navigate to="/parent" replace />} />
    <Route path="/child/:childId" element={<ChildInterface />} />
    {/* Grown-up side: behind the parent PIN once a child's screen has been
        open on this device. */}
    <Route element={<ParentGate />}>
      <Route path="/parent" element={<Dashboard />} />
      <Route path="/setup" element={<ChildSetup />} />
      <Route path="/settings" element={<ParentSettings />} />
      <Route path="/child-dashboard/:childId" element={<ChildDashboard />} />
      <Route path="/tasks" element={<TaskManagement />} />
      <Route path="/reports/:childId" element={<Reports />} />
    </Route>
    {DEV_TOOLS && (
      <>
        <Route path="/preview/checklist" element={<ChecklistPreview />} />
        <Route path="/preview/chore" element={<ChorePreview />} />
        <Route path="/preview/overdue" element={<ChildOverduePreview />} />
        <Route path="/preview/overdue-subtasks" element={<ChildOverdueSubtasksPreview />} />
        <Route path="/preview/overdue-subtasks-compact" element={<ChildOverdueSubtasksCompactPreview />} />
      </>
    )}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  // Motion for React: every animation in the app follows the device's
  // reduce-motion setting.
  <MotionConfig reducedMotion="user">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* The one toast system. hooks/use-toast.ts is a thin shim over it. */}
      <Sonner />
      <BrowserRouter>
        <AppErrorBoundary>
        <Routes>
          {/* Public routes — outside AuthProvider so unauth'd users can reach them. */}
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          {DEV_TOOLS && (
            <>
              <Route path="/preview/critters" element={<CrittersPreview />} />
              <Route path="/preview/time-reserve" element={<TimeReservePreview />} />
              <Route path="/preview/sprite-pet" element={<SpritePetPreview />} />
              <Route path="/preview/playtime" element={<AuthProvider><PlaytimePreview /></AuthProvider>} />
              <Route path="/preview/critter-editor" element={<CritterEditor />} />
            </>
          )}
          <Route
            path="*"
            element={
              <AuthProvider>
                <RealtimeQuerySync />
                <ParentNotifiers />
                <ProtectedRoutes />
              </AuthProvider>
            }
          />
        </Routes>
        </AppErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </MotionConfig>
);

export default App;
