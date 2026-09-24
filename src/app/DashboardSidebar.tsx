"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Search dashboard", icon: "⌕" },
  { href: "/trends", label: "Trend tracking", icon: "⌁" },
  { href: "/setup", label: "Requirements", icon: "▤" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return <>
    <button className="sidebar-menu-button" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="dashboard-sidebar" onClick={() => setOpen(!open)}>{open ? "×" : "☰"}</button>
    {open && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside id="dashboard-sidebar" className={`dashboard-sidebar${open ? " open" : ""}`}>
      <Link className="sidebar-brand" href="/" onClick={() => setOpen(false)}><span className="brand-mark">S</span><span>SNOWLAX<br />DASHBOARD</span></Link>
      <p className="sidebar-group">WORKSPACE</p>
      <nav aria-label="Dashboard navigation">
        {links.map(link => <Link key={link.href} href={link.href} className={`sidebar-link${pathname === link.href ? " active" : ""}`} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}><span className="sidebar-link-icon" aria-hidden="true">{link.icon}</span>{link.label}</Link>)}
      </nav>
      <div className="sidebar-footer">Open-source social listening</div>
    </aside>
  </>;
}
