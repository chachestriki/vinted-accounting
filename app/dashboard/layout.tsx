import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/libs/next-auth";
import config from "@/config";
import Sidebar from "@/components/Sidebar";

// Server-side layout: ensures user is logged in. All users can access the dashboard.
// hasAccess only restricts sync feature (Gmail synchronization) - see sync API routes.
export default async function LayoutPrivate({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">{children}</main>
    </div>
  );
}
