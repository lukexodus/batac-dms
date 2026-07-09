export interface SidebarUser {
  name: string;
  role: string;
}

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current (non-linked) final segment */
  href?: string;
}
