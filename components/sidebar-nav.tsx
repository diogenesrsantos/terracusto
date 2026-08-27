"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type SidebarNavItem = { href: string; label: string };
export type SidebarNavGroup = { label: string; items: SidebarNavItem[] };

const matchesPath = (pathname: string, href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

export function SidebarNav({ directItems, groups }: { directItems: SidebarNavItem[]; groups: SidebarNavGroup[] }) {
  const pathname = usePathname();
  const activeGroups = groups.filter((group) => group.items.some((item) => matchesPath(pathname, item.href))).map((group) => group.label);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeGroups));

  useEffect(() => {
    if (activeGroups.length === 0) return;
    setExpanded((current) => new Set([...current, ...activeGroups]));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(label: string) {
    setExpanded((current) => {
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
        {isExpanded && <div className="nav-submenu" id={contentId}>{group.items.map((item) => <Link key={item.href} className={matchesPath(pathname, item.href) ? "active" : ""} href={item.href}>{item.label}</Link>)}</div>}
      </div>;
    })}
  </nav>;
}
