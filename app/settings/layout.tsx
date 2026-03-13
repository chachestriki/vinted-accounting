import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/libs/next-auth";
import config from "@/config";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// All logged-in users can access settings. hasAccess only restricts sync feature.
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}

