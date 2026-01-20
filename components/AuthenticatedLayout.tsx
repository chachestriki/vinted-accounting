import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

// Shared layout component for authenticated pages
// This wraps pages with the sidebar and proper spacing
export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">{children}</main>
    </div>
  );
}

