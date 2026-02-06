"use client";

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/lib/store";

// Component imports (ensure these paths exist)
import Homepage from "./Homepage";
import SendForSignaturePage from "./send-for-signature/SendForSignaturePage";
import Profilepage from "./Profilepage";
import WorkflowListPage from "./workflows/WorkflowListPage";
import TemplateListPage from "./templates/TemplateListPage";
import { EnhancedReportsDashboard } from "./reports";
import SignForms from "./SignForms";

// Map of keys used by Redux activeComponent
const componentMap: Record<string, React.ComponentType<any>> = {
  Homepage,
  Documentform: SendForSignaturePage, // legacy key kept
  SendForSignaturePage: SendForSignaturePage,
  Profilepage,
  Workflows: WorkflowListPage, // workflows list page
  Templates: TemplateListPage, // templates list page
  Reports: EnhancedReportsDashboard, // Enhanced reports dashboard with better UI
  SignForms: SignForms, // New sign forms advanced UI (key must match Leftsidebar NavItem.component)
};

const Maincontent: React.FC = () => {
  const dispatch = useDispatch();
  const activeComponentName = useSelector((state: RootState) => state.mainContent.activeComponent);
  // Ensure hydration uses stored activeComponent if present
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('activeComponent');
      if (stored && stored !== activeComponentName) {
        // Avoid dispatch loop if already set
        dispatch({ type: 'mainContent/setActiveComponent', payload: stored });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ActiveComponent = componentMap[activeComponentName] || Homepage;

  return (
    <div className="h-full overflow-y-auto p-4">
      <ActiveComponent />
    </div>
  );
};

export default Maincontent;
