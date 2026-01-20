import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/libs/next-auth";
import config from "@/config";
import Sidebar from "@/components/Sidebar";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

// This is a server-side component to ensure the user is logged in AND has paid.
// If not logged in, it will redirect to the login page.
// If logged in but hasn't paid, it will redirect to pricing page.
// It's applied to all subpages of /dashboard in /app/dashboard/*** pages
// You can also add custom static UI elements like a Navbar, Sidebar, Footer, etc..
// See https://shipfa.st/docs/tutorials/private-page
export default async function LayoutPrivate({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  // Check if user has paid access
  await connectMongo();
  const user = await User.findOne({ email: session.user?.email });

  if (!user?.hasAccess) {
    redirect("/#pricing");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">{children}</main>
    </div>
  );
}
