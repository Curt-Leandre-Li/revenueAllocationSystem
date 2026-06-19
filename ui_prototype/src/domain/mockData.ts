import { routeFieldMappings } from "./fieldMap";
import type {
  DataRow,
  MetricItem,
  MockWorkspaceState,
  PageWorkspaceData,
  PreconditionItem,
  RoutePath,
  WorkbenchSnapshot,
} from "./types";

const sharedMetrics: MetricItem[] = [
  { label: "完整链路进度", value: "5/9", hint: "当前停在效用计算后", tone: "warning" },
  { label: "数据源主体", value: "3", hint: "进入 MD-DShap 权重池", tone: "success" },
  { label: "非数据贡献主体", value: "2", hint: "通过合同优先项处理", tone: "neutral" },
];

const sharedPreconditions: PreconditionItem[] = [
  {
    name: "输入快照",
    status: "PASS",
    targetPath: "/data/ingestion",
    message: "已完成演示数据接入和字段安全摘要。",
  },
  {
    name: "参与方边界",
    status: "PASS",
    targetPath: "/data/parties",
    message: "数据源主体与非数据贡献主体已区分。",
  },
  {
    name: "权重计算",
    status: "PENDING",
    targetPath: "/allocation/md-dshap",
    message: "需要执行 MD-DShap 后才能进行收益分配。",
  },
];

const pageContent: Record<
  RoutePath,
  {
    summary: string;
    primaryTask: string;
    metrics: MetricItem[];
    preconditions: PreconditionItem[];
    rows: DataRow[];
  }
> = {
  "/dashboard": {
    summary: "汇总当前项目状态、流程入口、风险提示、一键计算和最近产出。",
    primaryTask: "继续执行 MD-DShap 权重计算，生成可审计的参考分配输入。",
    metrics: [
      ...sharedMetrics,
      { label: "已完成节点", value: "5", hint: "接入、资源、参与方、质量、效用", tone: "success" },
      { label: "风险边界", value: "6", hint: "覆盖数据、算法、合同和报告", tone: "neutral" },
      { label: "默认算法", value: "MD-DShap", hint: "Basic Shapley 仅用于 baseline_check", tone: "neutral" },
    ],
    preconditions: sharedPreconditions,
    rows: [
      {
        project_name: "演示项目 A",
        scenario_name: "多主体数据价值分配演示",
        status: "已计算效用",
        current_package: "demo_input_2026_06",
        current_algorithm_task: "待启动",
        current_allocation: "尚未生成",
        recent_report_type: "资源摘要",
        recent_report_time: "2026-06-18 10:20",
      },
      {
        workflow_step: "MD-DShap 权重计算",
        step_status: "待处理",
        blocker: "无",
        next_module: "收益分配计算",
        next_action: "启动 MD-DShap",
        last_updated: "2026-06-18 10:22",
      },
      {
        data_boundary: "仅使用演示数据或用户上传 JSON 摘要",
        simulation_disclaimer: "结果仅作模拟参考",
        sensitive_data_notice: "敏感字段仅展示统计和标记",
        algorithm_boundary: "MD-DShap 输出权重，不生成付款指令",
        contract_boundary: "合同约束为模拟调整规则",
        report_boundary: "P0 支持 Markdown、CSV、JSON、JSONL",
      },
      {
        precondition_name: "效用值",
        check_result: "通过",
        failed_stage: "无",
        run_mode: "同步演示",
        algorithm_mode: "MD-DShap",
        pipeline_stage: "权重计算",
        stage_status: "待处理",
      },
    ],
  },
  "/data/ingestion": {
    summary: "管理演示数据选择、UTF-8 JSON 上传、校验失败详情和输入快照生成。",
    primaryTask: "优先处理上传校验错误，确保后续资源识别和参与方维护有稳定输入。",
    metrics: [
      { label: "数据包", value: "2", hint: "1 个有效，1 个停用候选", tone: "neutral" },
      { label: "识别资源", value: "6", hint: "来自有效输入快照", tone: "success" },
      { label: "校验问题", value: "1", hint: "字段类型待修复", tone: "warning" },
    ],
    preconditions: [
      {
        name: "UTF-8 JSON",
        status: "PASS",
        message: "上传文件编码符合要求。",
      },
      {
        name: "必要字段",
        status: "BLOCKED",
        message: "一个候选包缺少参与方类型字段。",
      },
    ],
    rows: [
      {
        package_name: "demo_input_2026_06",
        source_type: "演示数据",
        file_name: "demo.json",
        validation_status: "通过",
        access_status: "已接入",
        resource_count: 6,
        party_count: 5,
        created_at: "2026-06-18 09:30",
        error_field: "无",
        repair_suggestion: "可进入资源管理",
      },
      {
        package_name: "upload_candidate",
        source_type: "JSON 上传",
        file_name: "candidate.json",
        validation_status: "失败",
        access_status: "待修复",
        resource_count: 0,
        party_count: 0,
        created_at: "2026-06-18 10:12",
        error_field: "party_type",
        repair_suggestion: "补充参与方类型后重新校验",
      },
    ],
  },
  "/data/resources": {
    summary: "展示数据资源、字段模态、基础统计、敏感字段标记和数据源主体绑定。",
    primaryTask: "确认每个资源已绑定数据源主体，并明确是否纳入计算。",
    metrics: [
      { label: "资源", value: "6", hint: "结构化、文本、影像摘要", tone: "neutral" },
      { label: "已绑定主体", value: "5", hint: "仍有 1 个资源待确认", tone: "warning" },
      { label: "纳入计算", value: "5", hint: "排除演示说明材料", tone: "success" },
    ],
    preconditions: [
      {
        name: "输入快照",
        status: "PASS",
        targetPath: "/data/ingestion",
        message: "已有有效输入快照。",
      },
      {
        name: "资源主体关系",
        status: "PENDING",
        message: "剩余 1 个资源待绑定数据源主体。",
      },
    ],
    rows: [
      {
        resource_name: "筛查指标结构化表",
        modality: "结构化",
        field_count: 48,
        sample_count: 12000,
        missing_rate: "2.80%",
        sensitive_field_count: 3,
        provider_party: "数据源主体甲",
        split_ratio: "45%",
        include_in_calculation: "是",
        status: "有效",
      },
      {
        resource_name: "随访文本摘要",
        modality: "文本",
        field_count: 16,
        sample_count: 3600,
        missing_rate: "6.10%",
        sensitive_field_count: 2,
        provider_party: "待绑定",
        split_ratio: "0%",
        include_in_calculation: "待确认",
        status: "待处理",
      },
    ],
  },
  "/data/parties": {
    summary: "维护数据源主体与非数据贡献主体，防止非数据主体默认进入 MD-DShap 权重池。",
    primaryTask: "检查参与方类型和资源关系，确保权重池只包含数据贡献主体。",
    metrics: [
      { label: "参与方", value: "5", hint: "3 个数据源主体，2 个非数据主体", tone: "neutral" },
      { label: "进入权重池", value: "3", hint: "仅数据源主体", tone: "success" },
      { label: "合同优先项", value: "2", hint: "运营和技术服务主体", tone: "warning" },
    ],
    preconditions: [
      {
        name: "参与方类型",
        status: "PASS",
        message: "已区分数据源主体和非数据贡献主体。",
      },
      {
        name: "资源关系",
        status: "PENDING",
        targetPath: "/data/resources",
        message: "仍需补齐一个资源绑定关系。",
      },
    ],
    rows: [
      {
        party_name: "数据源主体甲",
        party_type: "数据提供方",
        is_data_provider: "是",
        include_in_md_dshap: "是",
        linked_resource_count: 3,
        status: "有效",
        contribution_summary: "高覆盖、低缺失",
      },
      {
        party_name: "技术服务方丁",
        party_type: "技术服务",
        is_data_provider: "否",
        include_in_md_dshap: "否",
        linked_resource_count: 0,
        status: "合同优先处理",
        contribution_summary: "不进入权重池",
      },
    ],
  },
  "/measure/quality": {
    summary: "配置质量权重并运行质量评估，保留指标证据和版本快照。",
    primaryTask: "复核低质量预警，确认质量因子可以进入后续数元计量。",
    metrics: [
      { label: "总分", value: "86.4", hint: "质量等级 A", tone: "success" },
      { label: "预警指标", value: "1", hint: "文本摘要缺失率偏高", tone: "warning" },
      { label: "参数版本", value: "v3", hint: "质量权重已保存", tone: "neutral" },
    ],
    preconditions: [
      {
        name: "数据资源",
        status: "PASS",
        targetPath: "/data/resources",
        message: "资源识别已完成。",
      },
    ],
    rows: [
      {
        metric_name: "完整性",
        metric_weight: "30%",
        score: 84.2,
        total_score: 86.4,
        quality_level: "A",
        quality_factor: "1.080000",
        evidence_summary: "缺失率整体低于阈值",
        low_quality_warning: "文本摘要需关注",
      },
    ],
  },
  "/measure/shuyuan": {
    summary: "配置数元基础单价、调用次数和场景/质量/技术/专家/发展系数。",
    primaryTask: "执行数元计量后输出资源、参与方和项目层明细。",
    metrics: [
      { label: "基础单价", value: "2.00", hint: "演示参数", tone: "neutral" },
      { label: "调用次数", value: "12,400", hint: "本轮模拟", tone: "success" },
      { label: "计量金额", value: "31,248.00", hint: "非结算金额", tone: "warning" },
    ],
    preconditions: [
      {
        name: "质量评估",
        status: "PASS",
        targetPath: "/measure/quality",
        message: "质量因子已生成。",
      },
    ],
    rows: [
      {
        base_shuyuan_price: "2.00",
        scenario_coefficient: "1.120000",
        quality_coefficient: "1.080000",
        technology_coefficient: "1.050000",
        expert_coefficient: "1.000000",
        development_coefficient: "0.980000",
        call_count: 12400,
        metering_amount: "31248.00",
      },
    ],
  },
  "/measure/utility": {
    summary: "计算贡献度、归一化贡献和效用值，为 MD-DShap 提供效用输入。",
    primaryTask: "核对各数据源主体的贡献因子和效用值，确保权重计算输入完整。",
    metrics: [
      { label: "数据源主体", value: "3", hint: "全部有贡献记录", tone: "success" },
      { label: "归一化合计", value: "1.000000", hint: "符合权重输入要求", tone: "success" },
      { label: "效用函数", value: "v2", hint: "已生成快照", tone: "neutral" },
    ],
    preconditions: [
      {
        name: "数元计量",
        status: "PASS",
        targetPath: "/measure/shuyuan",
        message: "计量明细已可用。",
      },
    ],
    rows: [
      {
        party_name: "数据源主体甲",
        valid_units: 5400,
        usage_weight: "0.420000",
        coverage_weight: "0.380000",
        scarcity_weight: "0.200000",
        contribution_score: "0.463200",
        normalized_contribution: "0.462800",
        quality_factor: "1.080000",
        usage_factor: "1.120000",
        scenario_factor: "1.050000",
        utility_value: "0.524316",
      },
      {
        party_name: "数据源主体乙",
        valid_units: 4100,
        usage_weight: "0.330000",
        coverage_weight: "0.440000",
        scarcity_weight: "0.230000",
        contribution_score: "0.324100",
        normalized_contribution: "0.323900",
        quality_factor: "1.030000",
        usage_factor: "1.070000",
        scenario_factor: "1.020000",
        utility_value: "0.363744",
      },
    ],
  },
  "/allocation/md-dshap": {
    summary: "以 MD-DShap 作为默认权重策略，Basic Shapley 仅作小规模 baseline_check。",
    primaryTask: "启动权重任务，生成归一化权重和边际贡献轨迹。",
    metrics: [
      { label: "算法模式", value: "MD-DShap", hint: "默认策略", tone: "success" },
      { label: "参与者", value: "3", hint: "仅数据源主体", tone: "neutral" },
      { label: "权重合计", value: "待计算", hint: "目标为 1.000000", tone: "warning" },
    ],
    preconditions: [
      {
        name: "效用值",
        status: "PASS",
        targetPath: "/measure/utility",
        message: "效用输入已生成。",
      },
      {
        name: "数据源主体",
        status: "PASS",
        targetPath: "/data/parties",
        message: "非数据主体已排除出权重池。",
      },
    ],
    rows: [
      {
        algorithm_mode: "MD-DShap",
        participant_set: "甲、乙、丙",
        task_set: "资源效用任务集",
        sample_rounds: 512,
        epsilon: "0.000100",
        task_status: "待启动",
        party_name: "数据源主体甲",
        participant_weight: "待计算",
        normalized_weight: "待计算",
        marginal_contribution: "待计算",
      },
    ],
  },
  "/allocation/simulation": {
    summary: "基于权重、优先分配和合同约束模拟收益分配结果。",
    primaryTask: "等待权重计算完成后配置总收益和合同优先分配。",
    metrics: [
      { label: "总收益", value: "500,000.00", hint: "模拟输入", tone: "neutral" },
      { label: "优先分配", value: "80,000.00", hint: "非数据主体合同优先项", tone: "warning" },
      { label: "数据源收益池", value: "420,000.00", hint: "等待权重", tone: "neutral" },
    ],
    preconditions: [
      {
        name: "MD-DShap 权重",
        status: "BLOCKED",
        targetPath: "/allocation/md-dshap",
        message: "缺少归一化权重，暂不能执行分配。",
      },
    ],
    rows: [
      {
        total_revenue: "500000.00",
        priority_allocation_amount: "80000.00",
        data_provider_revenue_pool: "420000.00",
        allocation_mode: "合同优先 + 权重分配",
        party_name: "数据源主体甲",
        raw_weight: "待计算",
        normalized_weight: "待计算",
        pre_constraint_amount: "待计算",
        post_constraint_amount: "待计算",
        adjustment_reason: "等待权重",
        scenario_status: "草稿",
      },
    ],
  },
  "/allocation/constraints": {
    summary: "维护合同约束、优先级和约束应用结果，采用逻辑停用而非物理删除。",
    primaryTask: "检查最小额、封顶、固定比例和优先分配规则是否冲突。",
    metrics: [
      { label: "有效约束", value: "4", hint: "最小额、封顶、固定比例", tone: "neutral" },
      { label: "停用约束", value: "1", hint: "保留审计历史", tone: "warning" },
      { label: "冲突项", value: "0", hint: "最近检查通过", tone: "success" },
    ],
    preconditions: [
      {
        name: "参与方",
        status: "PASS",
        targetPath: "/data/parties",
        message: "约束对象已在参与方清单中。",
      },
    ],
    rows: [
      {
        constraint_name: "技术服务优先分配",
        party_name: "技术服务方丁",
        constraint_type: "优先分配",
        value_type: "固定金额",
        constraint_value: "50000.00",
        priority: 1,
        status: "有效",
        before_amount: "0.00",
        after_amount: "50000.00",
        reason: "合同优先项模拟",
      },
    ],
  },
  "/reports": {
    summary: "预览并导出 Markdown、CSV、JSON、JSONL，PDF 保持 P1 禁用。",
    primaryTask: "选择报告范围并确认模拟参考与非法律结算说明。",
    metrics: [
      { label: "可导出格式", value: "4", hint: "Markdown、CSV、JSON、JSONL", tone: "success" },
      { label: "PDF", value: "P1", hint: "当前禁用", tone: "warning" },
      { label: "最近报告", value: "资源摘要", hint: "有版本和校验和", tone: "neutral" },
    ],
    preconditions: [
      {
        name: "报告来源",
        status: "PASS",
        message: "已有资源和效用快照可预览。",
      },
    ],
    rows: [
      {
        report_type: "资源摘要",
        report_status: "已生成",
        file_name: "resource_summary.md",
        file_type: "Markdown",
        field_scope: "资源、字段、参与方关系",
        generated_at: "2026-06-18 10:20",
        created_by: "local_operator",
        download_status: "可下载",
        p1_pdf_boundary: "PDF 为 P1",
      },
    ],
  },
  "/system/parameters": {
    summary: "维护场景系数、质量权重、MD-DShap 默认值、风险文案和精度规则。",
    primaryTask: "保存参数必须生成新版本，并记录前后值审计。",
    metrics: [
      { label: "参数组", value: "5", hint: "场景、质量、算法、风险、精度", tone: "neutral" },
      { label: "当前版本", value: "v3", hint: "本地操作员保存", tone: "success" },
      { label: "待确认变更", value: "0", hint: "无未保存项", tone: "neutral" },
    ],
    preconditions: [
      {
        name: "本地操作员",
        status: "PASS",
        message: "P0 本地模式允许维护参数版本。",
      },
    ],
    rows: [
      {
        parameter_group: "算法默认值",
        parameter_name: "MD-DShap sample_rounds",
        parameter_value: "512",
        effective_status: "生效",
        version_no: "v3",
        updated_by: "local_operator",
        updated_at: "2026-06-18 09:40",
        risk_disclaimer_text: "输出仅作模拟参考",
      },
    ],
  },
  "/system/users": {
    summary: "用户、角色和权限为 P1 规划能力；P0 不实现登录或生产级 RBAC。",
    primaryTask: "只读展示未来权限边界，不启用新增、编辑或密码重置。",
    metrics: [
      { label: "能力阶段", value: "P1", hint: "P0 禁用", tone: "warning" },
      { label: "当前模式", value: "本地操作员", hint: "无需登录", tone: "neutral" },
      { label: "可执行写操作", value: "0", hint: "防止误认为已实现", tone: "success" },
    ],
    preconditions: [
      {
        name: "P1 边界",
        status: "BLOCKED",
        message: "登录、RBAC 和密码重置不属于 P0。",
      },
    ],
    rows: [
      {
        username: "local_operator",
        display_name: "本地操作员",
        role_name: "P0 本地模式",
        menu_permission: "所有 P0 菜单可见",
        button_permission: "按按钮注册表控制",
        account_status: "无需登录",
        p1_boundary: "用户与权限写操作禁用",
      },
    ],
  },
  "/system/audit": {
    summary: "查询操作、计算、导出日志，并通过抽屉查看快照和失败原因。",
    primaryTask: "确认每次计算、锁定和导出都可追溯输入、参数和输出版本。",
    metrics: [
      { label: "今日记录", value: "18", hint: "操作、计算、导出", tone: "neutral" },
      { label: "失败记录", value: "1", hint: "上传校验失败", tone: "warning" },
      { label: "可导出", value: "JSONL", hint: "P0 审计导出", tone: "success" },
    ],
    preconditions: [
      {
        name: "审计写入",
        status: "PASS",
        message: "关键动作需保留输入、参数、输出和报告快照。",
      },
    ],
    rows: [
      {
        operation_type: "上传校验",
        object_type: "数据包",
        operator_id: "local_operator",
        module_code_display: "数据管理",
        menu_code_display: "数据接入管理",
        status: "失败",
        failure_reason: "party_type 缺失",
        created_at: "2026-06-18 10:12",
        report_type: "无",
      },
    ],
  },
};

function technicalValue(field: string, routePath: RoutePath, index: number) {
  if (field === "menu_code") {
    return routeFieldMappings.find((item) => item.routePath === routePath)?.menuCode ?? "";
  }
  if (field === "module_code") {
    return routeFieldMappings.find((item) => item.routePath === routePath)?.moduleCode ?? "";
  }
  if (field === "checksum") {
    return "sha256:demo-checksum-locked-after-export";
  }
  if (field.includes("json")) {
    return "{...}";
  }
  if (field.includes("version")) {
    return "v1.0-demo";
  }
  if (field.includes("reason")) {
    return "仅用于失败节点审计说明";
  }
  return `${field.replace(/_/g, "-")}-${index + 1}`;
}

function buildTechnicalDetails(routePath: RoutePath) {
  const mapping = routeFieldMappings.find((item) => item.routePath === routePath);
  if (!mapping) {
    return {};
  }

  return mapping.technicalFields.reduce<DataRow>((details, field, index) => {
    details[field.key] = technicalValue(field.key, routePath, index);
    return details;
  }, {});
}

function buildPages() {
  return routeFieldMappings.reduce<Record<RoutePath, PageWorkspaceData>>(
    (pages, mapping) => {
      const content = pageContent[mapping.routePath];
      pages[mapping.routePath] = {
        ...content,
        technicalDetails: buildTechnicalDetails(mapping.routePath),
      };
      return pages;
    },
    {} as Record<RoutePath, PageWorkspaceData>,
  );
}

export function createMockWorkspaceState(): MockWorkspaceState {
  return {
    currentRevenuePool: 420000,
    auditLogs: [
      {
        operation: "资源识别",
        objectType: "数据资源",
        operator: "local_operator",
        status: "成功",
        createdAt: "2026-06-18 10:12",
        summary: "识别 6 个资源，5 个已进入后续计算。",
      },
      {
        operation: "效用计算",
        objectType: "效用记录",
        operator: "local_operator",
        status: "成功",
        createdAt: "2026-06-18 10:24",
        summary: "生成 3 个数据源主体效用输入。",
      },
    ],
    snapshots: [
      {
        name: "输入快照",
        type: "INPUT",
        status: "已生成",
        createdAt: "2026-06-18 09:30",
      },
      {
        name: "效用输出快照",
        type: "UTILITY_OUTPUT",
        status: "已生成",
        createdAt: "2026-06-18 10:24",
      },
    ],
    reports: [
      {
        name: "资源摘要报告",
        type: "resource_summary",
        status: "已生成",
        createdAt: "2026-06-18 10:20",
        fieldScope: "资源名称、模态、字段统计、主体归属、计算设置",
      },
    ],
    exports: [
      {
        fileName: "resource_summary.csv",
        fileType: "CSV",
        status: "可下载",
        createdAt: "2026-06-18 10:20",
        fieldScope: "不包含敏感原文，仅包含脱敏统计字段",
      },
    ],
    dataProviders: [
      {
        name: "数据源主体甲",
        partyType: "DATA_PROVIDER",
        includeInMDDShap: true,
        linkedResourceCount: 3,
      },
      {
        name: "数据源主体乙",
        partyType: "DATA_PROVIDER",
        includeInMDDShap: true,
        linkedResourceCount: 2,
      },
      {
        name: "数据源主体丙",
        partyType: "DATA_PROVIDER",
        includeInMDDShap: true,
        linkedResourceCount: 1,
      },
    ],
    resources: [
      {
        resourceKey: "structured-screening",
        name: "筛查指标结构化表",
        modality: "结构化",
        fieldCount: 48,
        sampleCount: 12000,
        missingRate: 0.028,
        sensitiveFieldCount: 3,
        includeInCalculation: true,
        providerName: "数据源主体甲",
        splitRatio: 45,
        status: "有效",
        fieldStats: [
          { label: "数值字段", value: "32" },
          { label: "分类字段", value: "11" },
          { label: "日期字段", value: "5" },
        ],
        previewRows: [
          { 指标组: "基础特征", 脱敏样例: "年龄段、地区级别、随访次数" },
          { 指标组: "检测特征", 脱敏样例: "指标分桶、风险标签、时间窗口" },
        ],
        technicalDetails: {
          resource_id: "res-structured-screening",
          package_id: "pkg-demo-202606",
          field_id: "field-group-001",
          relation_id: "rel-structured-alpha",
        },
      },
      {
        resourceKey: "followup-text",
        name: "随访文本摘要",
        modality: "文本",
        fieldCount: 16,
        sampleCount: 3600,
        missingRate: 0.061,
        sensitiveFieldCount: 2,
        includeInCalculation: true,
        providerName: "未关联",
        splitRatio: 0,
        status: "阻断",
        fieldStats: [
          { label: "文本字段", value: "9" },
          { label: "标签字段", value: "5" },
          { label: "时间字段", value: "2" },
        ],
        previewRows: [
          { 摘要类型: "随访结论", 脱敏样例: "稳定、复查、需补充信息" },
          { 摘要类型: "干预记录", 脱敏样例: "建议级别、执行窗口、结果标签" },
        ],
        technicalDetails: {
          resource_id: "res-followup-text",
          package_id: "pkg-demo-202606",
          field_id: "field-group-002",
          relation_id: "未生成",
        },
      },
      {
        resourceKey: "image-feature",
        name: "影像特征向量",
        modality: "向量",
        fieldCount: 128,
        sampleCount: 8200,
        missingRate: 0.014,
        sensitiveFieldCount: 0,
        includeInCalculation: true,
        providerName: "数据源主体乙",
        splitRatio: 35,
        status: "有效",
        fieldStats: [
          { label: "向量维度", value: "128" },
          { label: "批次", value: "14" },
          { label: "异常值比例", value: "0.7%" },
        ],
        previewRows: [
          { 特征组: "embedding_A", 脱敏样例: "均值/方差/分位数统计" },
          { 特征组: "embedding_B", 脱敏样例: "聚类标签、质量分桶" },
        ],
        technicalDetails: {
          resource_id: "res-image-feature",
          package_id: "pkg-demo-202606",
          field_id: "field-group-003",
          relation_id: "rel-image-beta",
        },
      },
      {
        resourceKey: "ops-note",
        name: "运营说明材料",
        modality: "文档",
        fieldCount: 8,
        sampleCount: 24,
        missingRate: 0,
        sensitiveFieldCount: 0,
        includeInCalculation: false,
        providerName: "非数据贡献主体",
        splitRatio: 0,
        status: "不进入计算",
        fieldStats: [
          { label: "说明字段", value: "8" },
          { label: "业务备注", value: "24" },
        ],
        previewRows: [{ 说明类型: "流程备注", 脱敏样例: "不作为算法输入" }],
        technicalDetails: {
          resource_id: "res-ops-note",
          package_id: "pkg-demo-202606",
          field_id: "field-group-004",
          relation_id: "不适用",
        },
      },
    ],
    mdsParticipants: [
      {
        name: "数据源主体甲",
        partyType: "DATA_PROVIDER",
        contributionScore: 0.4628,
        utilityValue: 0.524316,
        qualityFactor: 1.08,
        includeInMDDShap: true,
      },
      {
        name: "数据源主体乙",
        partyType: "DATA_PROVIDER",
        contributionScore: 0.3239,
        utilityValue: 0.363744,
        qualityFactor: 1.03,
        includeInMDDShap: true,
      },
      {
        name: "数据源主体丙",
        partyType: "DATA_PROVIDER",
        contributionScore: 0.2133,
        utilityValue: 0.241918,
        qualityFactor: 0.98,
        includeInMDDShap: true,
      },
    ],
    mdsWeights: [],
    mdsTraces: [],
    mdsTasks: [
      {
        taskName: "MD-DShap 权重任务准备",
        algorithmMode: "MD_DSHAP",
        status: "待启动",
        progress: 0,
        seed: 20260618,
        sampleRounds: 512,
        epsilon: 0.0001,
        saveMarginalDetail: true,
        createdAt: "2026-06-18 10:30",
      },
    ],
  };
}

export const workbenchSnapshot: WorkbenchSnapshot = {
  projectName: "演示项目 A",
  scenarioName: "多主体数据价值分配演示",
  operator: "local_operator",
  status: "UTILITY_CALCULATED",
  updatedAt: "2026-06-18 10:30",
  mock: createMockWorkspaceState(),
  pages: buildPages(),
};
