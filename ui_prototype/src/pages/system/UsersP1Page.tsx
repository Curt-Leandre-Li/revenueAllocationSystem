import { useState } from "react";
import {
  DetailDrawer,
  DrawerSection,
  MetricCard,
  PageHeader,
  RiskNotice,
  WorkbenchCard,
} from "../../ui";
import type { PageProps } from "../pageTypes";

const roles = [
  { role: "本地操作员", scope: "P0 可用", permission: "本地演示操作、导出和审计查看" },
  { role: "系统管理员", scope: "P1 规划", permission: "用户、角色和权限配置" },
  { role: "审计查看员", scope: "P1 规划", permission: "跨用户审计查询与导出" },
];

export function UsersP1Page({ route, snapshot, onNavigate }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "p1" | "matrix">("");

  return (
    <div className="pageWorkspace phase2Page usersPage">
      <PageHeader
        route={{
          ...route,
          label: "用户与权限管理（P1）",
          responsibility: "P0 使用 local_operator；登录、用户、角色和生产级 RBAC 均为 P1 能力。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid four">
        <MetricCard item={{ label: "当前操作员", value: "local_operator", hint: "P0 本地模式", tone: "neutral" }} />
        <MetricCard item={{ label: "登录能力", value: "P1", hint: "P0 不启用", tone: "warning" }} />
        <MetricCard item={{ label: "生产级 RBAC", value: "P1", hint: "当前只读说明", tone: "warning" }} />
        <MetricCard item={{ label: "权限模型", value: "规划中", hint: "菜单 + 按钮权限", tone: "neutral" }} />
      </div>

      <RiskNotice compact />

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="P0 本地操作员模式"
          description="当前版本不做生产级用户管理，所有操作以 local_operator 写入审计。"
          actions={
            <>
              <button className="actionButton secondary" type="button" onClick={() => setDrawer("p1")}>查看 P1 权限说明</button>
              <button className="actionButton secondary" type="button" onClick={() => setDrawer("matrix")}>查看角色权限模型</button>
              <button className="actionButton secondary" type="button" onClick={() => onNavigate("/system/parameters")}>返回系统管理</button>
            </>
          }
        >
          <div className="boundaryList">
            <article><strong>当前版本</strong><span>仅 local_operator，本地操作和审计说明。</span></article>
            <article><strong>P1 才启用</strong><span>登录、用户、角色、权限、密码重置。</span></article>
            <article><strong>禁止误导</strong><span>不展示可真实创建生产用户的入口。</span></article>
          </div>
        </WorkbenchCard>

        <WorkbenchCard title="未来扩展入口" description="按钮保持说明性质，不创建真实账号。">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>角色</th><th>阶段</th><th>权限范围</th></tr></thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.role}>
                    <td><strong>{role.role}</strong></td>
                    <td><span className={role.scope.includes("P1") ? "p1Tag" : "tag success"}>{role.scope}</span></td>
                    <td>{role.permission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>
      </div>

      <DetailDrawer
        footerNote="P1 权限说明不代表当前 P0 已启用登录或生产 RBAC。"
        objectType="P1 说明"
        open={drawer === "p1"}
        size="md"
        statusTag="P1"
        title="P1 权限说明"
        variant="risk"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="P1 才启用">
          <ul className="plainList">
            <li>登录与用户管理</li>
            <li>角色授权和按钮权限</li>
            <li>密码重置与生产级审计策略</li>
          </ul>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="权限模型用于后续设计，不在 P0 创建真实用户或角色。"
        objectType="权限模型"
        open={drawer === "matrix"}
        size="lg"
        title="角色权限模型"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="菜单与按钮权限">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>角色</th><th>菜单范围</th><th>按钮范围</th><th>阶段</th></tr></thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.role}>
                    <td>{role.role}</td>
                    <td>{role.role === "本地操作员" ? "P0 全部本地页面" : "按角色配置"}</td>
                    <td>{role.role === "本地操作员" ? "P0 本地按钮" : "按按钮权限配置"}</td>
                    <td>{role.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
