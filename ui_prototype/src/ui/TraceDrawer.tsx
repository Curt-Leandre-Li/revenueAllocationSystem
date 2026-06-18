import type { DataRow } from "../domain/types";
import { fieldLabels } from "../domain/fieldMap";
import { DetailDrawer } from "./DetailDrawer";
import { DrawerSection } from "./DrawerSection";
import { TechnicalDetails } from "./TechnicalDetails";
import type { DrawerAction } from "./DrawerFooter";

type TraceColumn = {
  key: string;
  label?: string;
};

interface TraceDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  subtitle?: string;
  statusTag?: string;
  objectType?: string;
  actionCode?: string;
  summary?: string;
  formula?: string;
  input?: DataRow;
  parameters?: DataRow;
  output?: DataRow;
  traceRows?: DataRow[];
  traceColumns?: TraceColumn[];
  snapshots?: Array<{ name: string; status: string; createdAt?: string }>;
  details?: DataRow;
  technicalDetails?: DataRow;
  footerNote?: string;
  actions?: DrawerAction[];
}

function renderKeyValueBlock(data: DataRow) {
  return (
    <dl className="businessDetail compact">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{fieldLabels[key] ?? key}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TraceDrawer({
  open,
  title,
  onClose,
  subtitle,
  statusTag,
  objectType,
  actionCode,
  summary,
  formula,
  input,
  parameters,
  output,
  traceRows = [],
  traceColumns = [],
  snapshots = [],
  details,
  technicalDetails,
  footerNote,
  actions,
}: TraceDrawerProps) {
  const technical = technicalDetails ?? details ?? {};

  return (
    <DetailDrawer
      actionCode={actionCode}
      actions={actions}
      footerNote={footerNote}
      objectType={objectType}
      open={open}
      size="xl"
      statusTag={statusTag}
      subtitle={subtitle}
      technicalDetails={<TechnicalDetails details={technical} />}
      title={title}
      variant="trace"
      onClose={onClose}
    >
      {summary ? (
        <DrawerSection title="追溯摘要">
          <p className="drawerIntro">{summary}</p>
        </DrawerSection>
      ) : null}

      <div className="traceCompactGrid">
        {formula ? (
          <DrawerSection title="公式/规则">
            <pre className="codeBlock">{formula}</pre>
          </DrawerSection>
        ) : null}

        {input ? (
          <DrawerSection title="输入">
            {renderKeyValueBlock(input)}
          </DrawerSection>
        ) : null}

        {parameters ? (
          <DrawerSection title="参数">
            {renderKeyValueBlock(parameters)}
          </DrawerSection>
        ) : null}

        {output ? (
          <DrawerSection title="输出">
            {renderKeyValueBlock(output)}
          </DrawerSection>
        ) : null}
      </div>

      {traceRows.length > 0 && traceColumns.length > 0 ? (
        <DrawerSection title="Trace 明细" description="仅展示业务化字段，工程字段放入技术详情。">
          <div className="tableWrap drawerTableWrap">
            <table className="dataTable phase2Table drawerTable">
              <thead>
                <tr>
                  {traceColumns.map((column) => (
                    <th key={column.key}>{column.label ?? fieldLabels[column.key] ?? column.key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traceRows.map((row, index) => (
                  <tr key={index}>
                    {traceColumns.map((column) => (
                      <td key={column.key}>{String(row[column.key] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      ) : null}

      {snapshots.length > 0 ? (
        <DrawerSection title="快照记录">
          <div className="snapshotList">
            {snapshots.map((snapshot) => (
              <article key={`${snapshot.name}-${snapshot.createdAt ?? ""}`}>
                <strong>{snapshot.name}</strong>
                <span>{snapshot.status}</span>
                {snapshot.createdAt ? <small>{snapshot.createdAt}</small> : null}
              </article>
            ))}
          </div>
        </DrawerSection>
      ) : null}
    </DetailDrawer>
  );
}
