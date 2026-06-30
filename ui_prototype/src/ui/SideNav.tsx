import { useEffect, useMemo, useState } from "react";
import { getSideNavNodes, type MenuNode } from "../app/menu";
import type { RoutePath } from "../domain/types";

interface SideNavProps {
  activePath: RoutePath;
  collapsed: boolean;
  nodes?: MenuNode[];
  onCollapseChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onNavigate: (path: RoutePath) => void;
}

export function SideNav({
  activePath,
  collapsed,
  nodes: menuNodes,
  onCollapseChange,
  mobileOpen,
  onMobileOpenChange,
  onNavigate,
}: SideNavProps) {
  const nodes = useMemo(() => menuNodes ?? getSideNavNodes(), [menuNodes]);
  const activeGroupCode = useMemo(
    () => nodes.find((node) => isNodeActive(node, activePath))?.menuCode ?? "",
    [activePath, nodes],
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(activeGroupCode ? [activeGroupCode] : []),
  );

  useEffect(() => {
    if (!activeGroupCode) {
      return;
    }
    setExpandedGroups((current) => {
      const next = new Set(current);
      next.add(activeGroupCode);
      return next;
    });
  }, [activeGroupCode]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onMobileOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onMobileOpenChange]);

  function toggleGroup(menuCode: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(menuCode)) {
        next.delete(menuCode);
      } else {
        next.add(menuCode);
      }
      return next;
    });
  }

  function navigate(path: RoutePath) {
    onNavigate(path);
    onMobileOpenChange(false);
  }

  function handlePrimaryClick(node: MenuNode) {
    const children = node.children ?? [];
    if (children.length === 0) {
      navigate(node.routePath);
      return;
    }

    if (collapsed) {
      onCollapseChange(false);
    }
    toggleGroup(node.menuCode);
  }

  return (
    <>
      <button
        aria-label="关闭左侧导航"
        className={`sideNavOverlay${mobileOpen ? " open" : ""}`}
        type="button"
        onClick={() => onMobileOpenChange(false)}
      />
      <aside
        className={[
          "sideNav",
          collapsed ? "collapsed" : "",
          mobileOpen ? "mobileOpen" : "",
        ].filter(Boolean).join(" ")}
        aria-label="左侧导航"
      >
        <div className="sideNavHead">
          <div className="brandMark">DV</div>
          <div className="sideNavBrandText">
            <strong>数据收益分配系统</strong>
          </div>
          <button
            aria-label={collapsed ? "展开左侧导航" : "收起左侧导航"}
            className="sideNavCollapse"
            type="button"
            onClick={() => onCollapseChange(!collapsed)}
          >
            <span>{collapsed ? ">" : "<"}</span>
          </button>
        </div>

        <nav className="sideNavBody" aria-label="主导航">
          {nodes.map((node) => {
            const children = node.children ?? [];
            const hasChildren = children.length > 0;
            const expanded = expandedGroups.has(node.menuCode);
            const activeParent = isNodeActive(node, activePath);

            return (
              <div
                className={[
                  "sideNavGroupShell",
                  hasChildren ? "hasChildren" : "single",
                  expanded ? "expanded" : "",
                  activeParent ? "activeParent" : "",
                ].filter(Boolean).join(" ")}
                key={node.menuCode}
              >
                <button
                  className="sideNavPrimary"
                  title={collapsed ? node.label : undefined}
                  type="button"
                  onClick={() => handlePrimaryClick(node)}
                >
                  <NavIcon name={node.icon ?? "data"} />
                  <span className="sideNavLabel">{node.label}</span>
                  {node.p1Only ? <small className="p1Tag">P1</small> : null}
                  {hasChildren ? <span className="sideNavChevron">{expanded ? "v" : ">"}</span> : null}
                </button>

                {hasChildren ? (
                  <>
                    <div className="sideNavChildren">
                      {children.map((child) => (
                        <button
                          className={child.routePath === activePath ? "active" : ""}
                          key={child.menuCode}
                          type="button"
                          onClick={() => navigate(child.routePath)}
                        >
                          <span>{child.label}</span>
                          {child.p1Only ? <small className="p1Tag">P1</small> : null}
                        </button>
                      ))}
                    </div>
                    <div className="sideNavFlyout">
                      <strong>{node.label}</strong>
                      {children.map((child) => (
                        <button
                          className={child.routePath === activePath ? "active" : ""}
                          key={child.menuCode}
                          type="button"
                          onClick={() => navigate(child.routePath)}
                        >
                          <span>{child.label}</span>
                          {child.p1Only ? <small className="p1Tag">P1</small> : null}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <span className="sideNavTooltip">{node.label}</span>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function isNodeActive(node: MenuNode, activePath: RoutePath) {
  return (
    node.routePath === activePath ||
    Boolean(node.children?.some((child) => child.routePath === activePath))
  );
}

function NavIcon({ name }: { name: NonNullable<MenuNode["icon"]> }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  if (name === "home") {
    return (
      <svg aria-hidden="true" className="sideNavIcon" viewBox="0 0 24 24">
        <path {...common} d="M4 11.5 12 5l8 6.5" />
        <path {...common} d="M6.5 10.5V19h11v-8.5" />
      </svg>
    );
  }

  if (name === "data") {
    return (
      <svg aria-hidden="true" className="sideNavIcon" viewBox="0 0 24 24">
        <path {...common} d="M5 7c0-1.3 3.1-2.4 7-2.4S19 5.7 19 7s-3.1 2.4-7 2.4S5 8.3 5 7Z" />
        <path {...common} d="M5 7v5c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4V7" />
        <path {...common} d="M5 12v5c0 1.3 3.1 2.4 7 2.4s7-1.1 7-2.4v-5" />
      </svg>
    );
  }

  if (name === "measure") {
    return (
      <svg aria-hidden="true" className="sideNavIcon" viewBox="0 0 24 24">
        <path {...common} d="M5 18h14" />
        <path {...common} d="M7 15l3-5 3 3 4-7" />
        <path {...common} d="M7 6h3M15 18v-4M11 18v-3" />
      </svg>
    );
  }

  if (name === "allocation") {
    return (
      <svg aria-hidden="true" className="sideNavIcon" viewBox="0 0 24 24">
        <circle {...common} cx="7" cy="7" r="2.5" />
        <circle {...common} cx="17" cy="7" r="2.5" />
        <circle {...common} cx="12" cy="17" r="2.5" />
        <path {...common} d="M9 8.5 11 15M15 8.5 13 15M9.5 17h5" />
      </svg>
    );
  }

  if (name === "report") {
    return (
      <svg aria-hidden="true" className="sideNavIcon" viewBox="0 0 24 24">
        <path {...common} d="M7 4.5h7l3 3V19.5H7z" />
        <path {...common} d="M14 4.5v3h3M9.5 12h5M9.5 15.5h5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="sideNavIcon" viewBox="0 0 24 24">
      <path {...common} d="M5 8h14M7 12h10M9 16h6" />
      <path {...common} d="M6 5h12v14H6z" />
    </svg>
  );
}
