"use client";

import React from "react";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Package,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Popover, Transition } from "@headlessui/react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ventas", href: "/sales", icon: TrendingUp },
  { name: "Gastos", href: "/expenses", icon: DollarSign },
  { name: "Inventario", href: "/inventory", icon: Package },
];

const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-base-100 border-r border-base-300 flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-base-300">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-content" />
          </div>
          <span className="font-bold text-xl">Vintflow</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${active
                  ? "bg-base-300 font-semibold text-base-content"
                  : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="border-t border-base-300 p-4">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${pathname === "/settings"
              ? "bg-base-300 font-semibold text-base-content"
              : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
            }`}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </Link>
      </div>

      {/* User Profile */}
      <div className="border-t border-base-300 p-4">
        <Popover className="relative">
          {({ open }) => (
            <>
              <Popover.Button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-base-200 transition-colors duration-200">
                <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center shrink-0">
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="w-8 h-8 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {session?.user?.name?.charAt(0) ||
                        session?.user?.email?.charAt(0) ||
                        "U"}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-xs text-base-content/60 truncate">
                    {session?.user?.email || ""}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-base-content/60 transition-transform duration-200 ${open ? "transform rotate-180" : ""
                    }`}
                />
              </Popover.Button>
              <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Popover.Panel className="absolute bottom-full left-0 mb-2 w-full z-50">
                  <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-base-content/10 bg-base-100 p-1">
                    <div className="space-y-0.5 text-sm">
                      <button
                        className="flex items-center gap-2 hover:bg-error/20 hover:text-error duration-200 py-1.5 px-4 w-full rounded-lg font-medium"
                        onClick={handleSignOut}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                            clipRule="evenodd"
                          />
                          <path
                            fillRule="evenodd"
                            d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
};

export default Sidebar;

