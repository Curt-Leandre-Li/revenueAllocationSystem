import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  MetricCard,
  PageHeader,
  RiskNotice,
  WorkbenchCard,
} from "../../ui";
import type { DataRow } from "../../domain/types";
import type { PageProps } from "../pageTypes";

interface AlgorithmDraft {
  seed: number;
  sampleRounds: number;
  epsilon: number;
  baselineEnabled: boolean;
}

export function ParametersPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "algorithm" | "risk" | "version">("");
  const pageData = snapshot.pages[route.path];
  const parameterRows = pageData.rows;
  const metricValue = (label: string, fallback: string) =>
    pageData.metrics.find((item) => item.label === label)?.value ?? fallback;
  const parameterByCode = new Map(
    parameterRows.map((item) => [readCell(item, "parameter_code", ""), item]),
  );
  const sampleRounds = parameterByCode.get("DEFAULT_MD_DSHAP_SAMPLE_ROUNDS");
  const epsilon = parameterByCode.get("DEFAULT_MD_DSHAP_EPSILON");
  const riskText = parameterByCode.get("RISK_DISCLAIMER_TEXT");
  const [algorithmDraft, setAlgorithmDraft] = useState<AlgorithmDraft>(() =>
    algorithmDraftFromParameters(parameterByCode),
  );
  const [riskDraft, setRiskDraft] = useState(() => readCell(riskText, "current_value", ""));

  return (
    <div className="pageWorkspace phase2Page parametersPage">
      <PageHeader
        route={{
          ...route,
          label: "参数配置",
          responsibility: "维护质量权重、算法默认参数、风险文案、精度规则和参数版本。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid four">
        <MetricCard item={{ label: "参数版本", value: metricValue("参数版本", "暂不可用"), hint: "来自后端", tone: "neutral" }} />
        <MetricCard item={{ label: "算法模式", value: metricValue("算法模式", "MD_DSHAP"), hint: "默认模式", tone: "success" }} />
        <MetricCard item={{ label: "采样轮次", value: metricValue("采样轮次", "暂不可用"), hint: "必须 > 0", tone: sampleRounds ? "neutral" : "warning" }} />
        <MetricCard item={{ label: "收敛阈值", value: metricValue("收敛阈值", "暂不可用"), hint: "必须 > 0", tone: epsilon ? "neutral" : "warning" }} />
      </div>

      <RiskNotice compact />

      <WorkbenchCard
        title="参数组"
        description="高风险参数修改需要二次确认；保存版本只影响新计算，不回改历史结果。"
        actions={
          <>
            <button
              className="actionButton secondary"
              type="button"
              onClick={() => {
                setAlgorithmDraft(algorithmDraftFromParameters(parameterByCode));
                setDrawer("algorithm");
              }}
            >
              MD-DShap 参数配置
            </button>
            <button
              className="actionButton secondary"
              type="button"
              onClick={() => {
                setRiskDraft(readCell(riskText, "current_value", ""));
                setDrawer("risk");
              }}
            >
              风险提示文案配置
            </button>
            <ActionButton action={actionRegistry["PARAM-001"]} onClick={(action) => onAction(action)} />
            <ActionButton
              action={actionRegistry["PARAM-002"]}
              onClick={(action) =>
                onAction(action, {
                  kind: "parameter-restore",
                  parameterCode: "DEFAULT_MD_DSHAP_SAMPLE_ROUNDS",
                })
              }
            />
          </>
        }
      >
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead><tr><th>参数组</th><th>当前值</th><th>生效状态</th><th>操作</th></tr></thead>
            <tbody>
              {parameterRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>参数接口暂不可用；页面不会显示前端示例参数作为成功状态。</td>
                </tr>
              ) : parameterRows.map((item) => (
                <tr key={readCell(item, "parameter_code", readCell(item, "parameter_name", "parameter"))}>
                  <td><strong>{readCell(item, "parameter_name", "未命名参数")}</strong></td>
                  <td>{readCell(item, "current_value", "-")}</td>
                  <td><span className={readCell(item, "status", "") === "可编辑" ? "tag success" : "tag"}>{readCell(item, "status", "-")}</span></td>
                  <td><button type="button" onClick={() => setDrawer("version")}>查看版本</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WorkbenchCard>

      <DetailDrawer
        dirty
        footerNote="默认 algorithm_mode 必须为 MD_DSHAP；epsilon 和 sample_rounds 必须大于 0。"
        objectType="算法参数"
        open={drawer === "algorithm"}
        size="md"
        title="MD-DShap 参数配置"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          {
            label: "保存参数",
            type: "primary",
            onClick: () => {
              onAction(actionRegistry["PARAM-004"], {
                kind: "parameter-update",
                values: [
                  { parameterCode: "DEFAULT_MD_DSHAP_SEED", currentValue: algorithmDraft.seed },
                  {
                    parameterCode: "DEFAULT_MD_DSHAP_SAMPLE_ROUNDS",
                    currentValue: algorithmDraft.sampleRounds,
                  },
                  { parameterCode: "DEFAULT_MD_DSHAP_EPSILON", currentValue: algorithmDraft.epsilon },
                  {
                    parameterCode: "DEFAULT_MD_DSHAP_BASELINE_ENABLED",
                    currentValue: algorithmDraft.baselineEnabled,
                  },
                ],
              });
              setDrawer("");
            },
          },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="算法默认值">
          <div className="formGrid">
            <label>算法模式<input readOnly value="MD_DSHAP" /></label>
            <label>
              随机种子
              <input
                type="number"
                value={algorithmDraft.seed}
                onChange={(event) =>
                  setAlgorithmDraft((current) => ({ ...current, seed: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              采样轮次
              <input
                type="number"
                value={algorithmDraft.sampleRounds}
                onChange={(event) =>
                  setAlgorithmDraft((current) => ({
                    ...current,
                    sampleRounds: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              收敛阈值
              <input
                step="0.000001"
                type="number"
                value={algorithmDraft.epsilon}
                onChange={(event) =>
                  setAlgorithmDraft((current) => ({ ...current, epsilon: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              baseline_check
              <select
                value={algorithmDraft.baselineEnabled ? "是" : "否"}
                onChange={(event) =>
                  setAlgorithmDraft((current) => ({
                    ...current,
                    baselineEnabled: event.target.value === "是",
                  }))
                }
              >
                <option>是</option>
                <option>否</option>
              </select>
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        dirty
        footerNote="风险提示文案会出现在报告、导出和算法结果说明中。"
        objectType="风险文案"
        open={drawer === "risk"}
        size="md"
        title="风险提示文案配置"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          {
            label: "保存文案",
            type: "primary",
            onClick: () => {
              onAction(actionRegistry["PARAM-008"], {
                kind: "parameter-update",
                values: [
                  {
                    parameterCode: "RISK_DISCLAIMER_TEXT",
                    currentValue: riskDraft,
                  },
                ],
              });
              setDrawer("");
            },
          },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="默认文案">
          <textarea
            value={riskDraft}
            rows={5}
            onChange={(event) => setRiskDraft(event.target.value)}
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="参数版本只读展示；历史计算继续使用当时版本。"
        objectType="参数版本"
        open={drawer === "version"}
        size="md"
        title="参数版本详情"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="版本说明">
          <dl className="businessDetail compact">
            <div><dt>版本</dt><dd>{metricValue("参数版本", "暂不可用")}</dd></div>
            <div><dt>生效范围</dt><dd>仅影响新计算</dd></div>
            <div><dt>变更摘要</dt><dd>当前后端参数列表共 {parameterRows.length} 项</dd></div>
          </dl>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

function readCell(row: DataRow | undefined, key: string, fallback: string) {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function algorithmDraftFromParameters(parameters: Map<string, DataRow>): AlgorithmDraft {
  return {
    seed: Number(readCell(parameters.get("DEFAULT_MD_DSHAP_SEED"), "current_value", "42")) || 42,
    sampleRounds:
      Number(readCell(parameters.get("DEFAULT_MD_DSHAP_SAMPLE_ROUNDS"), "current_value", "64")) || 64,
    epsilon:
      Number(readCell(parameters.get("DEFAULT_MD_DSHAP_EPSILON"), "current_value", "0.000001")) ||
      0.000001,
    baselineEnabled:
      readCell(parameters.get("DEFAULT_MD_DSHAP_BASELINE_ENABLED"), "current_value", "true") !==
      "false",
  };
}
