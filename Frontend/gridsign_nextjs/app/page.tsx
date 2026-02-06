"use client";
import React from "react";
import Rightsidebar from "@/components/Rightsidebar";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import Leftsidebar from "@/components/Leftsidebar";
import Navbar from "@/components/Navbar";
import Maincontent from "@/components/Maincontent";

const PageRoot = () => {
    const activeComponent = useSelector((s: RootState) => s.mainContent.activeComponent);
    // Show RightSidebar ONLY on Homepage and Reports; hide on all other views
    const showRightSidebar = activeComponent === 'Homepage' || activeComponent === 'Reports';
    return (
        <div className="relative min-h-screen bg-background">
            <Leftsidebar />
            <Navbar />
            {showRightSidebar && <Rightsidebar />}
            <main className={
                "fixed top-16 left-64 right-0 bottom-0 overflow-y-auto " +
                (showRightSidebar ? 'xl:right-80' : '')
            }>
                <Maincontent />
            </main>
        </div>
    );
};

export default PageRoot;
