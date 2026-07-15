"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, Settings, LogOut, ChevronDown } from "lucide-react";
import { NAV, isGroup, isActiveHref, type NavLeaf, type NavGroup } from "../lib/nav";
import { FirmSwitcher } from "../app/firm-switcher";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
// ── Leaf link ────────────────────────────────────────────────────────────────
function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavLeaf;
  active: boolean;
  onNavigate?: () => void;
}) {
  if (item.soon) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 cursor-not-allowed select-none">
        <span className="flex items-center gap-3">
          {item.icon ? (
            <item.icon className="w-[18px] h-[18px] shrink-0" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 mx-[6px]" />
          )}
          {item.label}
        </span>
        <span className="text-[9px] uppercase font-bold tracking-wide bg-[#1a3322] text-gray-400 px-1.5 py-0.5 rounded">
          Soon
        </span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-[#15311f] text-white shadow-sm"
          : "text-gray-400 hover:text-white hover:bg-[#112419]"
      )}
    >
      {item.icon ? (
        <item.icon className="w-[18px] h-[18px] shrink-0" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 mx-[6px]" />
      )}
      <span>{item.label}</span>
    </Link>
  );
}

// ── Collapsible group ─────────────────────────────────────────────────────────
function NavGroupItem({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const hasActive = group.items.some((i) => !i.soon && isActiveHref(pathname, i.href));
  const [open, setOpen] = useState(hasActive);
  const Icon = group.icon;

  // Auto-open when one of its children becomes the active route.
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          hasActive ? "text-white" : "text-gray-400 hover:text-white hover:bg-[#112419]"
        )}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={cn("w-4 h-4 opacity-70 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 ml-4 pl-3 border-l border-[#1a3322] space-y-1">
          {group.items.map((i) => (
            <NavLink
              key={i.label}
              item={i}
              active={!i.soon && isActiveHref(pathname, i.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Sidebar content (shared by desktop rail + mobile sheet) ───────────────────
function SidebarContent({
  email,
  onSignOut,
  pathname,
  onNavigate,
}: {
  email?: string;
  onSignOut: () => void;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="p-5 border-b border-[#1a3322]">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-white/5 border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Invoixe" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg tracking-tight leading-tight">Invoixe</h2>
            <p className="text-[11px] text-green-400 font-medium">Billing Workspace</p>
          </div>
        </Link>
      </div>

      {/* Active firm */}
      <div className="p-4 border-b border-[#1a3322] bg-[#09140e]/50">
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Active Firm
        </label>
        <FirmSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV.map((entry) =>
          isGroup(entry) ? (
            <NavGroupItem key={entry.label} group={entry} pathname={pathname} onNavigate={onNavigate} />
          ) : (
            <NavLink
              key={entry.label}
              item={entry}
              active={isActiveHref(pathname, entry.href)}
              onNavigate={onNavigate}
            />
          )
        )}
      </nav>

      {/* Footer: user + settings + sign out */}
      <div className="p-4 border-t border-[#1a3322] bg-[#09140e]/50">
        <div className="mb-3 min-w-0">
          <p className="text-xs font-semibold text-white truncate" title={email ?? ""}>
            {email?.split("@")[0] || "User"}
          </p>
          <p className="text-[10px] text-gray-400 truncate" title={email ?? ""}>
            {email}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/settings"
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition",
              pathname === "/settings"
                ? "bg-[#0b2e27] border-green-600 text-white"
                : "border-gray-600 hover:border-gray-500 text-gray-300"
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button
            onClick={onSignOut}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-red-900/50 hover:border-red-600/70 text-red-400 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AppShell — the persistent authenticated layout. Desktop: a sticky sidebar
 * rail. Mobile: a top bar with a hamburger that opens a shadcn Sheet holding the
 * same sidebar content. Auth is passed in as props (no providers↔shell cycle).
 */
export function AppShell({
  children,
  email,
  onSignOut,
}: {
  children: ReactNode;
  email?: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile sheet on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#f8faf9] lg:grid lg:grid-cols-[260px_1fr]">
      {/* Mobile top bar */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#0d1c13] text-white lg:hidden border-b border-[#1e3424] sticky top-0 z-20">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="p-1 rounded-md hover:bg-[#1a3322]" aria-label="Open navigation menu">
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] p-0 bg-[#0d1c13] border-[#1a3322] text-gray-300 [&>button]:text-gray-400 [&>button]:hover:text-white"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent
              email={email}
              onSignOut={onSignOut}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Invoixe" className="w-7 h-7" />
          <span className="font-bold text-base tracking-tight">Invoixe</span>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:h-screen lg:sticky lg:top-0 bg-[#0d1c13] border-r border-[#1a3322] text-gray-300">
        <SidebarContent email={email} onSignOut={onSignOut} pathname={pathname} />
      </aside>

      {/* Content */}
      <main className="min-h-screen overflow-x-hidden">{children}</main>
    </div>
  );
}
