import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ProgressiveDisclosure,
  SummaryStrip,
} from "../../ui";
import type { DataRow } from "../../domain/types";
import { pageMetrics, pageRows } from "../backendPageData";
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
  const parameterRows = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const metricValue = (label: string, fallback: string) =>
    metrics.find((item) => item.label === label)?.value ?? fallback;
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
    <div className="pageWorkspace phase2Page leanPage parametersPage">
      <CompactPageHeader
        title="参数配置"
        description="维护计算参数、风险文案和版本记录；保存后只影响新的测算。"
        primaryAction={
          <ActionButton action={actionRegistry["PARAM-001"]} onClick={(action) => onAction(action)} />
        }
        secondaryActions={
          <button
            className="actionButton secondary"
            type="button"
            onClick={() => setDrawer("version")}
          >
            查看版本
          </button>
        }
      />

      <SummaryStrip
        items={[
          metrics[0] ?? { label: "参数版本", value: "暂无", hint: "待生成", tone: "neutral" },
          metrics[1] ?? { label: "算法模式", value: "暂无", hint: "待生成", tone: "neutral" },
          metrics[2] ?? { label: "采样轮次", value: "暂无", hint: "待生成", tone: "neutral" },
          metrics[3] ?? { label: "收敛阈值", value: "暂无", hint: "待生成", tone: "neutral" },
          { label: "生效范围", value: "新测算", hint: "不改历史", tone: "neutral" },
        ]}
      />

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>参数组</h2>
            <p>高风险参数修改需要确认；历史测算继续保留当时版本。</p>
          </div>
          <div className="rowAction">
            <button
              className="actionButton secondary"
              type="button"
              onClick={() => {
                setAlgorithmDraft(algorithmDraftFromParameters(parameterByCode));
                setDrawer("algorithm");
              }}
            >
              配置默认值
            </button>
            <button
              className="actionButton secondary"
              type="button"
              onClick={() => {
                setRiskDraft(readCell(riskText, "current_value", ""));
                setDrawer("risk");
              }}
            >
              配置风险文案
            </button>
            <ActionButton
              action={actionRegistry["PARAM-002"]}
              onClick={(action) =>
                onAction(action, {
                  kind: "parameter-restore",
                  parameterCode: "DEFAULT_MD_DSHAP_SAMPLE_ROUNDS",
                })
              }
            />
          </div>
        </div>

        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>参数组</th>
                <th>当前值</th>
                <th>生效状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {parameterRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyGuide title="暂无参数" description="参数列表生成后会在此展示。" />
                  </td>
                </tr>
              ) : parameterRows.map((item) => (
                <tr key={readCell(item, "parameter_code", readCell(item, "parameter_name", "parameter"))}>
                  <td><strong>{readCell(item, "parameter_name", "未命名参数")}</strong></td>
                  <td>{readCell(item, "current_value", "-")}</td>
                  <td>
                    <span className={readCell(item, "status", "") === "可编辑" ? "tag success" : "tag"}>
                      {readCell(item, "status", "-")}
                    </span>
                  </td>
                  <td>{readCell(item, "updated_at", "暂无")}</td>
                  <td><button type="button" onClick={() => setDrawer("version")}>版本</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ProgressiveDisclosure title="参数详情" summary="默认折叠">
        <dl className="businessDetail compact">
          <div><dt>采样轮次</dt><dd>{readCell(sampleRounds, "current_value", "暂无")}</dd></div>
          <div><dt>收敛阈值</dt><dd>{readCell(epsilon, "current_value", "暂无")}</dd></div>
          <div><dt>风险文案</dt><dd>{readCell(riskText, "current_value", "暂无")}</dd></div>
        </dl>
      </ProgressiveDisclosure>

      <DetailDrawer
        dirty
        footerNote="默认计算模式保持不变；采样轮次和收敛阈值必须大于 0。"
        objectType="算法参数"
        open={drawer === "algorithm"}
        size="md"
        title="默认参数配置"
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
              基线校验
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
        footerNote="风险提示文案会出现在报告、导出和结果说明中。"
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
        footerNote="参数版本只读展示；历史测算继续使用当时版本。"
        objectType="参数版本"
        open={drawer === "version"}
        size="md"
        title="参数版本详情"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="版本说明">
          <dl className="businessDetail compact">
            <div><dt>版本</dt><dd>{metricValue("参数版本", "暂无")}</dd></div>
            <div><dt>生效范围</dt><dd>仅影响新测算</dd></div>
            <div><dt>变更摘要</dt><dd>当前参数列表共 {parameterRows.length} 项</dd></div>
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
