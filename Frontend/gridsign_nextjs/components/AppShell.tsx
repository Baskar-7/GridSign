"use client";

import React from "react";
import Navbar from "./Navbar";
import Leftsidebar from "./Leftsidebar";
import Rightsidebar from "./Rightsidebar";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";

interface AppShellProps {
	children: React.ReactNode;
}

// Conventional layout: full-width navbar at top, below it a flex row with sidebar + main content
// Sidebar starts directly with navigation items (logo moved to Navbar)
const AppShell: React.FC<AppShellProps> = ({ children }) => {
	const activeComponent = useSelector((state: RootState) => state.mainContent.activeComponent);
	// Hide right sidebar for these domain pages
	const hideRightSidebar = ["Workflows", "Templates", "Reports"].includes(activeComponent);

	return (
		<div className="min-h-screen w-full flex flex-col bg-background text-foreground">
			<Navbar />
			<div className="flex flex-1 pt-16">
				<Leftsidebar />
				<main className="flex-1 overflow-y-auto p-4">{children}</main>
				{!hideRightSidebar && <Rightsidebar />}
			</div>
		</div>
	);
};

export default AppShell;

