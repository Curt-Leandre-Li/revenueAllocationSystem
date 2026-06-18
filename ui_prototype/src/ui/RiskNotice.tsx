interface RiskNoticeProps {
  compact?: boolean;
}

export function RiskNotice({ compact = false }: RiskNoticeProps) {
  return (
    <section className={`riskNotice ${compact ? "compact" : ""}`}>
      <strong>模拟参考边界</strong>
      <p>
        本系统输出仅作数据收益分配模拟与审计说明参考，不作为法律结算、法定结算、付款指令、合同履约或主管机构审批依据。
      </p>
    </section>
  );
}
