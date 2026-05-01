import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import AuthProvider from "@/components/AuthProvider";
import ImportantTaskNotifier from "@/components/ImportantTaskNotifier";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ChildSetup from "./pages/ChildSetup";
import ChildInterface from "./pages/ChildInterface";
import ChildDashboard from "./pages/ChildDashboard";
import TaskManagement from "./pages/TaskManagement";
import NotFound from "./pages/NotFound";
import ChildrenSideBySide from "./pages/ChildrenSideBySide";
import ChecklistPreview from "./pages/ChecklistPreview";
import ChorePreview from "./pages/ChorePreview";
import ChildOverduePreview from "./pages/ChildOverduePreview";
import ChildOverdueSubtasksPreview from "./pages/ChildOverdueSubtasksPreview";
import ChildOverdueSubtasksCompactPreview from "./pages/ChildOverdueSubtasksCompactPreview";

const ReportsRedirect = () => {
  const { childId } = useParams();
  return <Navigate to={`/child-dashboard/${childId}`} replace />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ImportantTaskNotifier />
          <Routes>
            <Route path="/" element={<ChildrenSideBySide />} />
            <Route path="/landing" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/setup" element={<ChildSetup />} />
            <Route path="/child/:childId" element={<ChildInterface />} />
            <Route path="/child-dashboard/:childId" element={<ChildDashboard />} />
            <Route path="/tasks" element={<TaskManagement />} />
            <Route path="/reports/:childId" element={<ReportsRedirect />} />
            <Route path="/preview/checklist" element={<ChecklistPreview />} />
            <Route path="/preview/chore" element={<ChorePreview />} />
            <Route path="/preview/overdue" element={<ChildOverduePreview />} />
            <Route path="/preview/overdue-subtasks" element={<ChildOverdueSubtasksPreview />} />
            <Route path="/preview/overdue-subtasks-compact" element={<ChildOverdueSubtasksCompactPreview />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
