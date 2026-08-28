"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type SidebarNavItem = { href: string; label: string };
export type SidebarNavGroup = { label: string; items: SidebarNavItem[] };

const matchesPath = (pathname: string, href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
const EXPANDED_GROUPS_KEY = "terracusto.sidebar.expandedGroups";

export function SidebarNav({ directItems, groups }: { directItems: SidebarNavItem[]; groups: SidebarNavGroup[] }) {
  const pathname = usePathname();
  const activeGroups = groups.filter((group) => group.items.some((item) => matchesPath(pathname, item.href))).map((group) => group.label);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeGroups));

  useEffect(() => {
    let saved: string[] = [];
    try {
      const value = JSON.parse(window.localStorage.getItem(EXPANDED_GROUPS_KEY) || "[]");
      if (Array.isArray(value)) saved = value.filter((item): item is string => typeof item === "string");
    } catch { /* Ignore a malformed local preference. */ }
    const next = new Set([...saved, ...activeGroups]);
    setExpanded(next);
    window.localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify([...next]));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateExpanded(change: (current: Set<string>) => Set<string>) {
    setExpanded((current) => {
      const next = change(current);
      window.localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function expand(label: string) {
    updateExpanded((current) => new Set([...current, label]));
  }

  function toggle(label: string) {
    updateExpanded((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  return <nav className="nav" aria-label="Menu principal">
    {directItems.map((item) => <Link key={item.href} className={matchesPath(pathname, item.href) ? "active" : ""} href={item.href}>{item.label}</Link>)}
    {groups.map((group, index) => {
      const isExpanded = expanded.has(group.label);
      const hasActiveItem = group.items.some((item) => matchesPath(pathname, item.href));
      const contentId = `sidebar-submenu-${index}`;
      return <div className="nav-group" key={group.label}>
        <button className={`nav-group-trigger${hasActiveItem ? " active" : ""}`} type="button" onClick={() => toggle(group.label)} aria-expanded={isExpanded} aria-controls={contentId}>
          <span>{group.label}</span><svg className={`nav-chevron${isExpanded ? " expanded" : ""}`} viewBox="0 0 20 20" aria-hidden="true"><path d="m6.5 8 3.5 3.5L13.5 8" /></svg>
        </button>
        {isExpanded && <div className="nav-submenu" id={contentId}>{group.items.map((item) => <Link key={item.href} className={matchesPath(pathname, item.href) ? "active" : ""} href={item.href} onClick={() => expand(group.label)}>{item.label}</Link>)}</div>}
      </div>;
    })}
  </nav>;
}
