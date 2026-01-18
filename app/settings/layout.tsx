import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/libs/next-auth";
import config from "@/config";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export default async function SettingsLayout({
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

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}

