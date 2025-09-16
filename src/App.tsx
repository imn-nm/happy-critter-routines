import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthProvider from "@/components/AuthProvider";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ChildSetup from "./pages/ChildSetup";
import ChildInterface from "./pages/ChildInterface";
import ChildDashboard from "./pages/ChildDashboard";
import TaskManagement from "./pages/TaskManagement";
import ChildReports from "./pages/ChildReports";
import NotFound from "./pages/NotFound";
import ChildrenSideBySide from "./pages/ChildrenSideBySide";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<ChildrenSideBySide />} />
            <Route path="/landing" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/setup" element={<ChildSetup />} />
            <Route path="/child/:childId" element={<ChildInterface />} />
            <Route path="/child-dashboard/:childId" element={<ChildDashboard />} />
            <Route path="/tasks" element={<TaskManagement />} />
            <Route path="/reports/:childId" element={<ChildReports />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
