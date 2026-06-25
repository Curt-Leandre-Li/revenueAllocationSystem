import { useState } from "react";
import {
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  InlineNotice,
  SummaryStrip,
} from "../../ui";
import type { PageProps } from "../pageTypes";

const roles = [
  { role: "本地操作员", scope: "P0 可用", permission: "本地演示操作、导出和记录查看" },
  { role: "系统管理员", scope: "P1 规划", permission: "用户、角色和权限配置" },
  { role: "审计查看员", scope: "P1 规划", permission: "跨用户记录查询与导出" },
];

export function UsersP1Page({ onNavigate }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "p1" | "matrix">("");

  return (
    <div className="pageWorkspace phase2Page leanPage usersPage">
      <CompactPageHeader
        title="用户与权限"
        description="当前版本使用本地演示用户；登录、角色和生产级权限为 P1 规划能力。"
        primaryAction={
          <button className="actionButton secondary" type="button" onClick={() => setDrawer("p1")}>
            查看 P1 说明
          </button>
        }
        secondaryActions={
          <button
            className="actionButton secondary"
            type="button"
            onClick={() => onNavigate("/system/parameters")}
          >
            返回参数配置
          </button>
        }
      />

      <SummaryStrip
        items={[
          { label: "当前用户", value: "本地演示用户", hint: "P0 本地模式", tone: "neutral" },
          { label: "登录能力", value: "P1", hint: "暂未启用", tone: "warning" },
          { label: "角色管理", value: "P1", hint: "暂未启用", tone: "warning" },
          { label: "权限配置", value: "P1", hint: "暂未启用", tone: "warning" },
          { label: "审计查看", value: "可用", hint: "查看记录", tone: "success" },
        ]}
      />

      <InlineNotice tone="neutral">
        当前版本不提供真实账号创建、密码重置或生产权限配置入口。
      </InlineNotice>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>权限说明</h2>
            <p>P1 能力仅作为规划说明，当前页面不会创建真实用户或角色。</p>
          </div>
          <button className="textLinkButton" type="button" onClick={() => setDrawer("matrix")}>
            查看角色模型
          </button>
        </div>

        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>角色</th>
                <th>阶段</th>
                <th>权限范围</th>
              </tr>
            </thead>
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
      </section>

      <DetailDrawer
        footerNote="P1 权限说明不代表当前版本已启用登录或生产权限。"
        objectType="P1 说明"
        open={drawer === "p1"}
        size="md"
        statusTag="P1"
        title="P1 权限说明"
        variant="risk"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后续版本能力">
          <ul className="plainList">
            <li>登录与用户管理</li>
            <li>角色授权和按钮权限</li>
            <li>密码重置与生产级审计策略</li>
          </ul>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="权限模型用于后续设计，不在当前版本创建真实用户或角色。"
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
              <thead>
                <tr>
                  <th>角色</th>
                  <th>菜单范围</th>
                  <th>按钮范围</th>
                  <th>阶段</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.role}>
                    <td>{role.role}</td>
                    <td>{role.role === "本地操作员" ? "P0 本地页面" : "按角色配置"}</td>
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
