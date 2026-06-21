-- DVAS P0 PostgreSQL Schema
-- 数据收益分配系统 P0 标准关系数据库结构
-- Target: PostgreSQL 13+
-- Database: dvas_p0
-- Schema: dvas

BEGIN;

CREATE SCHEMA IF NOT EXISTS dvas;
SET search_path TO dvas;

-- ------------------------------------------------------------
-- 1. 菜单、权限、用户与角色基础表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nav_menu (
    menu_id        varchar(64) PRIMARY KEY,
    parent_id      varchar(64) REFERENCES nav_menu(menu_id) ON DELETE CASCADE,
    menu_code      varchar(64) NOT NULL UNIQUE,
    menu_name      varchar(100) NOT NULL,
    module_code    varchar(32) NOT NULL,
    route_path     varchar(200) NOT NULL,
    menu_level     smallint NOT NULL CHECK (menu_level IN (1, 2)),
    sort_no        int NOT NULL,
    p0_required    boolean NOT NULL DEFAULT true,
    p1_only        boolean NOT NULL DEFAULT false,
    status         varchar(16) NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED','DISABLED')),
    created_at     timestamp NOT NULL DEFAULT now(),
    updated_at     timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE nav_menu IS '导航菜单表，固化六大一级导航与二级页面。';

CREATE TABLE IF NOT EXISTS permission (
    permission_id   varchar(64) PRIMARY KEY,
    menu_id         varchar(64) NOT NULL REFERENCES nav_menu(menu_id) ON DELETE CASCADE,
    permission_code varchar(100) NOT NULL UNIQUE,
    permission_name varchar(120) NOT NULL,
    action_type     varchar(32) NOT NULL CHECK (action_type IN ('VIEW','CREATE','UPDATE','DELETE_DISABLE','CALCULATE','EXPORT','CONFIRM')),
    button_code     varchar(100),
    p0_required     boolean NOT NULL DEFAULT true,
    p1_only         boolean NOT NULL DEFAULT false,
    status          varchar(16) NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED','DISABLED')),
    created_at      timestamp NOT NULL DEFAULT now(),
    updated_at      timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE permission IS '按钮/动作权限表，P0 用于按钮可用性说明，P1 接入 RBAC。';

CREATE TABLE IF NOT EXISTS user_account (
    user_id       varchar(64) PRIMARY KEY,
    username      varchar(80) NOT NULL UNIQUE,
    display_name  varchar(100) NOT NULL,
    operator_code varchar(80) NOT NULL UNIQUE,
    password_hash varchar(255),
    status        varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at    timestamp NOT NULL DEFAULT now(),
    updated_at    timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE user_account IS '用户表；P0 仅初始化 local_operator，P1 启用登录。';

CREATE TABLE IF NOT EXISTS role (
    role_id     varchar(64) PRIMARY KEY,
    role_code   varchar(64) NOT NULL UNIQUE,
    role_name   varchar(100) NOT NULL,
    description text,
    status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at  timestamp NOT NULL DEFAULT now(),
    updated_at  timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE role IS '角色表，支撑 P1 RBAC，P0 保留本地操作员角色。';

CREATE TABLE IF NOT EXISTS user_role (
    id         varchar(64) PRIMARY KEY,
    user_id    varchar(64) NOT NULL REFERENCES user_account(user_id) ON DELETE CASCADE,
    role_id    varchar(64) NOT NULL REFERENCES role(role_id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (user_id, role_id)
);
COMMENT ON TABLE user_role IS '用户角色关系表。';

CREATE TABLE IF NOT EXISTS role_permission (
    id            varchar(64) PRIMARY KEY,
    role_id       varchar(64) NOT NULL REFERENCES role(role_id) ON DELETE CASCADE,
    permission_id varchar(64) NOT NULL REFERENCES permission(permission_id) ON DELETE CASCADE,
    created_at    timestamp NOT NULL DEFAULT now(),
    UNIQUE (role_id, permission_id)
);
COMMENT ON TABLE role_permission IS '角色权限关系表。';

-- ------------------------------------------------------------
-- 2. 项目根对象与审计快照
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allocation_project (
    project_id                varchar(64) PRIMARY KEY,
    project_name              varchar(200) NOT NULL,
    scenario_name             varchar(200),
    status                    varchar(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','INGESTED','ASSESSED','METERED','UTILITY_CALCULATED','WEIGHT_CALCULATED','ALLOCATED','CONFIRMED','EXPORTED','DISABLED')),
    current_package_id         varchar(64),
    current_algorithm_task_id  varchar(64),
    current_allocation_id      varchar(64),
    total_revenue_amount       numeric(18,2) CHECK (total_revenue_amount IS NULL OR total_revenue_amount >= 0),
    version_no                 int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    created_by                 varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at                 timestamp NOT NULL DEFAULT now(),
    updated_at                 timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE allocation_project IS '项目主表，所有业务链路的根对象。';

CREATE TABLE IF NOT EXISTS snapshot_store (
    snapshot_id      varchar(64) PRIMARY KEY,
    project_id       varchar(64) REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    snapshot_type    varchar(40) NOT NULL CHECK (snapshot_type IN ('INPUT','PARAMETER','RESULT','REPORT','ALGORITHM','ALLOCATION','ASSUMPTION','OTHER')),
    object_type      varchar(80),
    object_id        varchar(64),
    content_json     jsonb NOT NULL,
    checksum         varchar(128) NOT NULL,
    created_by       varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at       timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE snapshot_store IS '通用快照表，统一保存输入、参数、结果、报告与算法快照。';

-- ------------------------------------------------------------
-- 3. 数据接入、资源与参与方
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS input_snapshot (
    snapshot_id   varchar(64) PRIMARY KEY,
    project_id    varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    source_type   varchar(32) NOT NULL CHECK (source_type IN ('DEMO','UPLOAD_JSON')),
    source_name   varchar(200),
    content_json  jsonb NOT NULL,
    checksum      varchar(128) NOT NULL,
    created_by    varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at    timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE input_snapshot IS '输入快照表，上传或演示数据初始化时生成。';

CREATE TABLE IF NOT EXISTS data_package (
    package_id        varchar(64) PRIMARY KEY,
    project_id        varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    input_snapshot_id varchar(64) REFERENCES input_snapshot(snapshot_id) ON DELETE SET NULL,
    package_name      varchar(200) NOT NULL,
    source_type       varchar(32) NOT NULL CHECK (source_type IN ('DEMO','UPLOAD_JSON')),
    file_name         varchar(255),
    checksum          varchar(128) NOT NULL,
    status            varchar(32) NOT NULL DEFAULT 'VALID' CHECK (status IN ('DRAFT','VALID','INVALID','DISABLED')),
    version_no        int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    created_by        varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at        timestamp NOT NULL DEFAULT now(),
    updated_at        timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE data_package IS '数据包表，数据接入管理主表。';

CREATE TABLE IF NOT EXISTS upload_validation_result (
    validation_result_id varchar(64) PRIMARY KEY,
    project_id           varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    package_id           varchar(64) REFERENCES data_package(package_id) ON DELETE CASCADE,
    is_valid             boolean NOT NULL,
    error_field          varchar(200),
    error_type           varchar(80),
    error_message        text,
    detail_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at           timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE upload_validation_result IS '上传校验结果表，失败详情页面读取。';

CREATE TABLE IF NOT EXISTS data_resource (
    resource_id            varchar(64) PRIMARY KEY,
    project_id             varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    package_id             varchar(64) NOT NULL REFERENCES data_package(package_id) ON DELETE CASCADE,
    resource_name          varchar(200) NOT NULL,
    modality               varchar(40) NOT NULL DEFAULT 'TABLE',
    field_count            int NOT NULL DEFAULT 0 CHECK (field_count >= 0),
    sample_count           bigint NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
    missing_rate           numeric(8,6) NOT NULL DEFAULT 0 CHECK (missing_rate >= 0 AND missing_rate <= 1),
    include_in_calculation boolean NOT NULL DEFAULT true,
    resource_summary_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
    status                 varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at             timestamp NOT NULL DEFAULT now(),
    updated_at             timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE data_resource IS '数据资源表，保存资源摘要、模态、样本和计算标记。';

CREATE TABLE IF NOT EXISTS data_resource_field (
    field_id            varchar(64) PRIMARY KEY,
    resource_id         varchar(64) NOT NULL REFERENCES data_resource(resource_id) ON DELETE CASCADE,
    field_name          varchar(160) NOT NULL,
    field_type          varchar(80),
    is_sensitive        boolean NOT NULL DEFAULT false,
    missing_rate        numeric(8,6) NOT NULL DEFAULT 0 CHECK (missing_rate >= 0 AND missing_rate <= 1),
    distinct_count      bigint CHECK (distinct_count IS NULL OR distinct_count >= 0),
    stats_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
    sample_preview_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at          timestamp NOT NULL DEFAULT now(),
    UNIQUE (resource_id, field_name)
);
COMMENT ON TABLE data_resource_field IS '资源字段表，支持字段统计与脱敏预览。';

CREATE TABLE IF NOT EXISTS party (
    party_id             varchar(64) PRIMARY KEY,
    project_id           varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_name           varchar(200) NOT NULL,
    party_type           varchar(40) NOT NULL CHECK (party_type IN ('DATA_PROVIDER','OPERATOR','PILOT_BASE','TECH_SERVICE','EXPERT','CONTRACT_OTHER')),
    include_in_md_dshap  boolean NOT NULL DEFAULT false,
    credit_code          varchar(100),
    contact_name         varchar(100),
    description          text,
    status               varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at           timestamp NOT NULL DEFAULT now(),
    updated_at           timestamp NOT NULL DEFAULT now(),
    UNIQUE (project_id, party_name)
);
COMMENT ON TABLE party IS '参与方表，项目内参与方名称唯一。';

CREATE TABLE IF NOT EXISTS data_resource_party_relation (
    relation_id         varchar(64) PRIMARY KEY,
    project_id          varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    resource_id         varchar(64) NOT NULL REFERENCES data_resource(resource_id) ON DELETE CASCADE,
    party_id            varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE CASCADE,
    split_ratio         numeric(18,6) NOT NULL DEFAULT 1 CHECK (split_ratio >= 0 AND split_ratio <= 1),
    is_primary_provider boolean NOT NULL DEFAULT false,
    include_in_md_dshap boolean NOT NULL DEFAULT true,
    status              varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now(),
    UNIQUE (resource_id, party_id)
);
COMMENT ON TABLE data_resource_party_relation IS '资源主体关系表，资源进入算法前必须关联数据源主体。';

-- ------------------------------------------------------------
-- 4. 质量评估、数元计量、贡献度与效用
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quality_metric_template (
    metric_id          varchar(64) PRIMARY KEY,
    metric_code        varchar(80) NOT NULL UNIQUE,
    parent_metric_code varchar(80),
    metric_name        varchar(160) NOT NULL,
    metric_level       smallint NOT NULL CHECK (metric_level IN (1,2)),
    default_weight     numeric(18,6) NOT NULL CHECK (default_weight >= 0 AND default_weight <= 1),
    score_rule_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
    status             varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at         timestamp NOT NULL DEFAULT now(),
    updated_at         timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE quality_metric_template IS '质量指标模板表。';

CREATE TABLE IF NOT EXISTS quality_assessment (
    assessment_id         varchar(64) PRIMARY KEY,
    project_id            varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    package_id            varchar(64) NOT NULL REFERENCES data_package(package_id) ON DELETE CASCADE,
    assessment_version_no int NOT NULL DEFAULT 1 CHECK (assessment_version_no >= 1),
    quality_score         numeric(8,4) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
    quality_level         varchar(20) NOT NULL,
    quality_factor        numeric(12,6) NOT NULL CHECK (quality_factor >= 0),
    dimension_scores      jsonb NOT NULL DEFAULT '{}'::jsonb,
    evidence_summary      text,
    parameter_snapshot_id varchar(64),
    status                varchar(16) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED','DISABLED')),
    generated_at          timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE quality_assessment IS '质量评估表，保存质量总分、等级、维度分和证据。';

CREATE TABLE IF NOT EXISTS quality_score_detail (
    detail_id        varchar(64) PRIMARY KEY,
    assessment_id    varchar(64) NOT NULL REFERENCES quality_assessment(assessment_id) ON DELETE CASCADE,
    metric_code      varchar(80) NOT NULL,
    dimension_code   varchar(80) NOT NULL,
    metric_name      varchar(160) NOT NULL,
    weight           numeric(18,6) NOT NULL CHECK (weight >= 0 AND weight <= 1),
    score            numeric(8,4) NOT NULL CHECK (score >= 0 AND score <= 100),
    weighted_score   numeric(12,6) NOT NULL CHECK (weighted_score >= 0),
    evidence_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE quality_score_detail IS '质量得分明细表，保存一级/二级指标得分。';

CREATE TABLE IF NOT EXISTS shuyuan_metering (
    metering_id              varchar(64) PRIMARY KEY,
    project_id               varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    assessment_id            varchar(64) NOT NULL REFERENCES quality_assessment(assessment_id) ON DELETE RESTRICT,
    metering_version_no      int NOT NULL DEFAULT 1 CHECK (metering_version_no >= 1),
    base_shuyuan_price       numeric(18,2) NOT NULL CHECK (base_shuyuan_price > 0),
    scenario_coefficient     numeric(12,6) NOT NULL DEFAULT 1 CHECK (scenario_coefficient > 0),
    quality_coefficient      numeric(12,6) NOT NULL DEFAULT 1 CHECK (quality_coefficient > 0),
    technology_coefficient   numeric(12,6) NOT NULL DEFAULT 1 CHECK (technology_coefficient > 0),
    expert_coefficient       numeric(12,6) NOT NULL DEFAULT 1 CHECK (expert_coefficient > 0),
    development_coefficient  numeric(12,6) NOT NULL DEFAULT 1 CHECK (development_coefficient > 0),
    call_count_total         bigint NOT NULL DEFAULT 0 CHECK (call_count_total >= 0),
    total_amount             numeric(18,2) NOT NULL CHECK (total_amount >= 0),
    parameter_snapshot_id    varchar(64),
    status                   varchar(16) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED','DISABLED')),
    generated_at             timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE shuyuan_metering IS '数元计量主表。';

CREATE TABLE IF NOT EXISTS shuyuan_metering_detail (
    detail_id        varchar(64) PRIMARY KEY,
    metering_id      varchar(64) NOT NULL REFERENCES shuyuan_metering(metering_id) ON DELETE CASCADE,
    project_id       varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    resource_id      varchar(64) NOT NULL REFERENCES data_resource(resource_id) ON DELETE RESTRICT,
    party_id         varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    call_count       bigint NOT NULL DEFAULT 0 CHECK (call_count >= 0),
    effective_units  numeric(18,6) NOT NULL DEFAULT 0 CHECK (effective_units >= 0),
    metering_amount  numeric(18,2) NOT NULL CHECK (metering_amount >= 0),
    formula_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE shuyuan_metering_detail IS '数元计量明细表，支持资源级与参与方级计量。';

CREATE TABLE IF NOT EXISTS contribution_record (
    contribution_id          varchar(64) PRIMARY KEY,
    project_id               varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_id                 varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    metering_id              varchar(64) REFERENCES shuyuan_metering(metering_id) ON DELETE SET NULL,
    valid_units              numeric(18,6) NOT NULL DEFAULT 0 CHECK (valid_units >= 0),
    usage_weight             numeric(18,6) NOT NULL DEFAULT 0 CHECK (usage_weight >= 0),
    coverage_weight          numeric(18,6) NOT NULL DEFAULT 0 CHECK (coverage_weight >= 0),
    scarcity_weight          numeric(18,6) NOT NULL DEFAULT 0 CHECK (scarcity_weight >= 0),
    contribution_score       numeric(18,6) NOT NULL DEFAULT 0 CHECK (contribution_score >= 0),
    normalized_contribution  numeric(18,6) NOT NULL DEFAULT 0 CHECK (normalized_contribution >= 0 AND normalized_contribution <= 1),
    version_no               int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    created_at               timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE contribution_record IS '贡献度记录表，按参与方保存贡献信号。';

CREATE TABLE IF NOT EXISTS utility_function_snapshot (
    snapshot_id       varchar(64) PRIMARY KEY,
    project_id        varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    utility_source    varchar(80) NOT NULL DEFAULT 'DEFAULT_FORMULA',
    formula_text      text NOT NULL,
    parameter_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
    checksum          varchar(128) NOT NULL,
    version_no        int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    created_by        varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at        timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE utility_function_snapshot IS '效用函数快照表，用于报告披露效用函数来源。';

CREATE TABLE IF NOT EXISTS utility_record (
    utility_id                   varchar(64) PRIMARY KEY,
    project_id                   varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_id                     varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    contribution_id              varchar(64) REFERENCES contribution_record(contribution_id) ON DELETE SET NULL,
    utility_function_snapshot_id varchar(64) NOT NULL REFERENCES utility_function_snapshot(snapshot_id) ON DELETE RESTRICT,
    task_key                     varchar(80) NOT NULL DEFAULT 'DEFAULT_TASK',
    normalized_contribution      numeric(18,6) NOT NULL DEFAULT 0 CHECK (normalized_contribution >= 0),
    quality_factor               numeric(12,6) NOT NULL DEFAULT 1 CHECK (quality_factor > 0),
    usage_factor                 numeric(12,6) NOT NULL DEFAULT 1 CHECK (usage_factor > 0),
    scenario_factor              numeric(12,6) NOT NULL DEFAULT 1 CHECK (scenario_factor > 0),
    utility_value                numeric(18,6) NOT NULL DEFAULT 0 CHECK (utility_value >= 0),
    version_no                   int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    created_at                   timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE utility_record IS '效用记录表，是 MD-DShap 的 v(S,t) 来源。';

CREATE TABLE IF NOT EXISTS utility_trace (
    trace_id              varchar(64) PRIMARY KEY,
    utility_id            varchar(64) NOT NULL REFERENCES utility_record(utility_id) ON DELETE CASCADE,
    formula_text          text NOT NULL,
    input_json            jsonb NOT NULL,
    output_json           jsonb NOT NULL,
    parameter_snapshot_id varchar(64),
    created_at            timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE utility_trace IS '效用 trace 表，保存公式、输入值与输出值。';

-- ------------------------------------------------------------
-- 5. MD-DShap、收益分配与合同约束
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS md_dshap_task (
    task_id                      varchar(64) PRIMARY KEY,
    project_id                   varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    utility_function_snapshot_id varchar(64) REFERENCES utility_function_snapshot(snapshot_id) ON DELETE SET NULL,
    algorithm_mode               varchar(32) NOT NULL DEFAULT 'MD_DSHAP' CHECK (algorithm_mode IN ('MD_DSHAP','BASIC_SHAPLEY')),
    participant_set_json         jsonb NOT NULL DEFAULT '[]'::jsonb,
    task_set_json                jsonb NOT NULL DEFAULT '[]'::jsonb,
    seed                         bigint,
    sample_rounds                int NOT NULL DEFAULT 200 CHECK (sample_rounds > 0),
    epsilon                      numeric(18,8) NOT NULL DEFAULT 0.000001 CHECK (epsilon >= 0),
    status                       varchar(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELLED')),
    algorithm_version            varchar(40) NOT NULL DEFAULT 'p0-md-dshap-1.0',
    baseline_enabled             boolean NOT NULL DEFAULT false,
    parameter_snapshot_id        varchar(64),
    failure_reason               text,
    started_at                   timestamp,
    finished_at                  timestamp,
    created_by                   varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at                   timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE md_dshap_task IS 'MD-DShap 任务表，默认 algorithm_mode=MD_DSHAP。';

CREATE TABLE IF NOT EXISTS md_dshap_result (
    result_id              varchar(64) PRIMARY KEY,
    task_id                varchar(64) NOT NULL REFERENCES md_dshap_task(task_id) ON DELETE CASCADE,
    project_id             varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_id               varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    participant_weight     numeric(18,6) NOT NULL CHECK (participant_weight >= 0 AND participant_weight <= 1),
    normalized_weight      numeric(18,6) NOT NULL CHECK (normalized_weight >= 0 AND normalized_weight <= 1),
    baseline_weight        numeric(18,6) CHECK (baseline_weight IS NULL OR baseline_weight >= 0),
    weight_diff            numeric(18,6),
    task_level_weight_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    approximation_note     text,
    result_version         int NOT NULL DEFAULT 1 CHECK (result_version >= 1),
    created_at             timestamp NOT NULL DEFAULT now(),
    UNIQUE (task_id, party_id)
);
COMMENT ON TABLE md_dshap_result IS 'MD-DShap 权重结果表，参与方权重进入收益分配。';

CREATE TABLE IF NOT EXISTS md_dshap_marginal_trace (
    trace_id              varchar(64) PRIMARY KEY,
    task_id               varchar(64) NOT NULL REFERENCES md_dshap_task(task_id) ON DELETE CASCADE,
    project_id            varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_id              varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    task_key              varchar(80) NOT NULL DEFAULT 'DEFAULT_TASK',
    iteration_no          int NOT NULL CHECK (iteration_no >= 0),
    coalition_before      jsonb NOT NULL DEFAULT '[]'::jsonb,
    participant_added     varchar(64) NOT NULL,
    v_before              numeric(18,6) NOT NULL DEFAULT 0,
    v_after               numeric(18,6) NOT NULL DEFAULT 0,
    marginal_contribution numeric(18,6) NOT NULL DEFAULT 0,
    random_seed           bigint,
    created_at            timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE md_dshap_marginal_trace IS '边际贡献明细表，用于算法审计和复杂度说明。';

CREATE TABLE IF NOT EXISTS algorithm_audit_snapshot (
    snapshot_id             varchar(64) PRIMARY KEY,
    project_id              varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    task_id                 varchar(64) NOT NULL REFERENCES md_dshap_task(task_id) ON DELETE CASCADE,
    input_snapshot_json     jsonb NOT NULL,
    parameter_snapshot_json jsonb NOT NULL,
    output_snapshot_json    jsonb NOT NULL,
    assumption_text         text NOT NULL,
    checksum                varchar(128) NOT NULL,
    created_at              timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE algorithm_audit_snapshot IS '算法审计快照表，导出 md_dshap_audit_report.md 的依据。';

CREATE TABLE IF NOT EXISTS allocation_scenario (
    allocation_id                varchar(64) PRIMARY KEY,
    project_id                   varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    weight_task_id               varchar(64) REFERENCES md_dshap_task(task_id) ON DELETE SET NULL,
    scenario_name                varchar(200) NOT NULL,
    total_revenue                numeric(18,2) NOT NULL CHECK (total_revenue >= 0),
    priority_allocation_amount   numeric(18,2) NOT NULL DEFAULT 0 CHECK (priority_allocation_amount >= 0),
    data_provider_revenue_pool   numeric(18,2) NOT NULL DEFAULT 0 CHECK (data_provider_revenue_pool >= 0),
    allocation_mode              varchar(40) NOT NULL DEFAULT 'MD_DSHAP_WEIGHT' CHECK (allocation_mode IN ('MD_DSHAP_WEIGHT','CONTRIBUTION','UTILITY','MANUAL')),
    status                       varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ALLOCATED','CONFIRMED','LOCKED','FAILED')),
    version_no                   int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    locked_by                    varchar(64),
    locked_at                    timestamp,
    created_by                   varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at                   timestamp NOT NULL DEFAULT now(),
    updated_at                   timestamp NOT NULL DEFAULT now(),
    CHECK (priority_allocation_amount <= total_revenue),
    CHECK (data_provider_revenue_pool <= total_revenue)
);
COMMENT ON TABLE allocation_scenario IS '收益分配场景表，保存总收益、合同优先与数据源收益池。';

CREATE TABLE IF NOT EXISTS allocation_priority_item (
    item_id         varchar(64) PRIMARY KEY,
    allocation_id   varchar(64) NOT NULL REFERENCES allocation_scenario(allocation_id) ON DELETE CASCADE,
    project_id      varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_id        varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    priority_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (priority_amount >= 0),
    priority_ratio  numeric(18,6) CHECK (priority_ratio IS NULL OR (priority_ratio >= 0 AND priority_ratio <= 1)),
    basis_text      text NOT NULL,
    priority_order  int NOT NULL DEFAULT 1,
    status          varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at      timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE allocation_priority_item IS '合同优先分配项表，先于数据源收益池扣除。';

CREATE TABLE IF NOT EXISTS contract_constraint (
    constraint_id     varchar(64) PRIMARY KEY,
    project_id        varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_id          varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    constraint_type   varchar(40) NOT NULL CHECK (constraint_type IN ('MIN_AMOUNT','MAX_AMOUNT','CAP_AMOUNT','FLOOR_AMOUNT','FIXED_RATIO','PRIORITY_AMOUNT')),
    constraint_value  numeric(18,6) NOT NULL CHECK (constraint_value >= 0),
    priority          int NOT NULL DEFAULT 1 CHECK (priority >= 1),
    basis_text        text,
    status            varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_by        varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at        timestamp NOT NULL DEFAULT now(),
    updated_at        timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE contract_constraint IS '合同约束表，支持最小、最大、封顶、保底、固定比例和优先分配。';

CREATE TABLE IF NOT EXISTS allocation_result (
    result_id                     varchar(64) PRIMARY KEY,
    allocation_id                 varchar(64) NOT NULL REFERENCES allocation_scenario(allocation_id) ON DELETE CASCADE,
    project_id                    varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    party_id                      varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    raw_weight                    numeric(18,6) NOT NULL DEFAULT 0 CHECK (raw_weight >= 0),
    normalized_weight             numeric(18,6) NOT NULL DEFAULT 0 CHECK (normalized_weight >= 0 AND normalized_weight <= 1),
    pre_constraint_amount         numeric(18,2) NOT NULL DEFAULT 0 CHECK (pre_constraint_amount >= 0),
    post_constraint_amount        numeric(18,2) NOT NULL DEFAULT 0 CHECK (post_constraint_amount >= 0),
    adjustment_amount             numeric(18,2) NOT NULL DEFAULT 0,
    constraint_adjustment_reason  text,
    result_version                int NOT NULL DEFAULT 1 CHECK (result_version >= 1),
    created_at                    timestamp NOT NULL DEFAULT now(),
    UNIQUE (allocation_id, party_id)
);
COMMENT ON TABLE allocation_result IS '收益分配结果表，保存约束前后金额。';

CREATE TABLE IF NOT EXISTS constraint_apply_trace (
    trace_id          varchar(64) PRIMARY KEY,
    allocation_id     varchar(64) NOT NULL REFERENCES allocation_scenario(allocation_id) ON DELETE CASCADE,
    project_id        varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    constraint_id     varchar(64) REFERENCES contract_constraint(constraint_id) ON DELETE SET NULL,
    party_id          varchar(64) NOT NULL REFERENCES party(party_id) ON DELETE RESTRICT,
    before_amount     numeric(18,2) NOT NULL CHECK (before_amount >= 0),
    after_amount      numeric(18,2) NOT NULL CHECK (after_amount >= 0),
    adjustment_amount numeric(18,2) NOT NULL,
    reason            text NOT NULL,
    step_no           int NOT NULL CHECK (step_no >= 1),
    created_at        timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE constraint_apply_trace IS '约束执行 trace 表，支持约束调整前后对比。';

-- ------------------------------------------------------------
-- 6. 报告、导出、审计与参数
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_record (
    report_id          varchar(64) PRIMARY KEY,
    project_id         varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    source_snapshot_id varchar(64) REFERENCES snapshot_store(snapshot_id) ON DELETE SET NULL,
    report_type        varchar(60) NOT NULL,
    report_version_no  int NOT NULL DEFAULT 1 CHECK (report_version_no >= 1),
    file_name          varchar(255) NOT NULL,
    file_format        varchar(16) NOT NULL CHECK (file_format IN ('MD','CSV','JSON','JSONL','ZIP','PDF')),
    file_path          varchar(500) NOT NULL,
    checksum           varchar(128) NOT NULL,
    status             varchar(16) NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED','FAILED','DISABLED')),
    created_by         varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at         timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE report_record IS '报告记录表，每次导出生成 report_id 和 checksum，不覆盖历史文件。';

CREATE TABLE IF NOT EXISTS export_file (
    file_id          varchar(64) PRIMARY KEY,
    report_id        varchar(64) NOT NULL REFERENCES report_record(report_id) ON DELETE CASCADE,
    project_id        varchar(64) NOT NULL REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    file_name         varchar(255) NOT NULL,
    file_type         varchar(60) NOT NULL,
    file_format       varchar(16) NOT NULL CHECK (file_format IN ('MD','CSV','JSON','JSONL','ZIP','PDF')),
    file_path         varchar(500) NOT NULL,
    field_scope_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
    checksum          varchar(128) NOT NULL,
    created_by        varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at        timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE export_file IS '导出文件明细表，一次报告导出可包含多个文件。';

CREATE TABLE IF NOT EXISTS audit_log (
    log_id                varchar(64) PRIMARY KEY,
    project_id            varchar(64) REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    module_code           varchar(32) NOT NULL,
    menu_code             varchar(64) NOT NULL,
    operation_type        varchar(40) NOT NULL CHECK (operation_type IN ('VIEW','CREATE','UPDATE','DELETE_DISABLE','CALCULATE','EXPORT','CONFIRM','SYSTEM')),
    object_type           varchar(80) NOT NULL,
    object_id             varchar(64),
    operator_id           varchar(64) NOT NULL DEFAULT 'local_operator',
    role_code             varchar(64) NOT NULL DEFAULT 'LOCAL_OPERATOR',
    before_value_json     jsonb,
    after_value_json      jsonb,
    input_snapshot_id     varchar(64),
    parameter_snapshot_id varchar(64),
    result_snapshot_id    varchar(64),
    status                varchar(16) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED')),
    failure_reason        text,
    checksum              varchar(128),
    created_at            timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE audit_log IS '审计日志表，记录新增、编辑、删除、计算、导出等关键操作。';

CREATE TABLE IF NOT EXISTS system_parameter (
    parameter_id       varchar(64) PRIMARY KEY,
    parameter_code     varchar(100) NOT NULL UNIQUE,
    parameter_name     varchar(160) NOT NULL,
    parameter_type     varchar(40) NOT NULL CHECK (parameter_type IN ('TEXT','NUMBER','BOOLEAN','JSON','ENUM')),
    default_value_json jsonb NOT NULL,
    current_value_json jsonb NOT NULL,
    scope              varchar(40) NOT NULL DEFAULT 'GLOBAL' CHECK (scope IN ('GLOBAL','PROJECT','QUALITY','METERING','ALGORITHM','REPORT','RISK')),
    is_editable        boolean NOT NULL DEFAULT true,
    version_no         int NOT NULL DEFAULT 1 CHECK (version_no >= 1),
    status             varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    updated_by         varchar(64) NOT NULL DEFAULT 'local_operator',
    updated_at         timestamp NOT NULL DEFAULT now(),
    created_at         timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE system_parameter IS '系统参数表，保存质量、算法、报告、风险文案与精度规则。';

CREATE TABLE IF NOT EXISTS parameter_version (
    version_id     varchar(64) PRIMARY KEY,
    parameter_id   varchar(64) NOT NULL REFERENCES system_parameter(parameter_id) ON DELETE CASCADE,
    project_id     varchar(64) REFERENCES allocation_project(project_id) ON DELETE CASCADE,
    version_no     int NOT NULL CHECK (version_no >= 1),
    value_json     jsonb NOT NULL,
    checksum       varchar(128) NOT NULL,
    created_by     varchar(64) NOT NULL DEFAULT 'local_operator',
    created_at     timestamp NOT NULL DEFAULT now(),
    UNIQUE (parameter_id, project_id, version_no)
);
COMMENT ON TABLE parameter_version IS '参数版本表，参数修改只影响新计算，不回改历史结果。';

-- ------------------------------------------------------------
-- 7. 索引
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_nav_menu_parent_sort ON nav_menu(parent_id, sort_no);
CREATE INDEX IF NOT EXISTS idx_nav_menu_module ON nav_menu(module_code);
CREATE INDEX IF NOT EXISTS idx_permission_menu_action ON permission(menu_id, action_type);
CREATE INDEX IF NOT EXISTS idx_project_status_created ON allocation_project(status, created_at);
CREATE INDEX IF NOT EXISTS idx_snapshot_project_type ON snapshot_store(project_id, snapshot_type, created_at);
CREATE INDEX IF NOT EXISTS idx_data_package_project_status ON data_package(project_id, status, checksum);
CREATE INDEX IF NOT EXISTS idx_data_resource_package_modality ON data_resource(package_id, modality, include_in_calculation);
CREATE INDEX IF NOT EXISTS idx_party_project_type_dshap ON party(project_id, party_type, include_in_md_dshap);
CREATE INDEX IF NOT EXISTS idx_relation_project_party ON data_resource_party_relation(project_id, party_id);
CREATE INDEX IF NOT EXISTS idx_quality_project_package_version ON quality_assessment(project_id, package_id, assessment_version_no);
CREATE INDEX IF NOT EXISTS idx_metering_project_assessment_version ON shuyuan_metering(project_id, assessment_id, metering_version_no);
CREATE INDEX IF NOT EXISTS idx_contribution_project_party ON contribution_record(project_id, party_id);
CREATE INDEX IF NOT EXISTS idx_utility_project_party_task ON utility_record(project_id, party_id, task_key);
CREATE INDEX IF NOT EXISTS idx_md_task_project_status_mode ON md_dshap_task(project_id, status, algorithm_mode, created_at);
CREATE INDEX IF NOT EXISTS idx_md_result_task_party ON md_dshap_result(task_id, party_id);
CREATE INDEX IF NOT EXISTS idx_md_trace_task_party_iter ON md_dshap_marginal_trace(task_id, party_id, iteration_no);
CREATE INDEX IF NOT EXISTS idx_allocation_project_status ON allocation_scenario(project_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_allocation_result_alloc_party ON allocation_result(allocation_id, party_id);
CREATE INDEX IF NOT EXISTS idx_constraint_project_party_status ON contract_constraint(project_id, party_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_report_project_type_created ON report_record(project_id, report_type, created_at);
CREATE INDEX IF NOT EXISTS idx_export_report ON export_file(report_id, file_type);
CREATE INDEX IF NOT EXISTS idx_audit_project_module_object ON audit_log(project_id, module_code, operation_type, object_type, object_id, created_at);
CREATE INDEX IF NOT EXISTS idx_system_parameter_scope_status ON system_parameter(scope, status);

GRANT USAGE ON SCHEMA dvas TO dvas_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA dvas TO dvas_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA dvas GRANT SELECT ON TABLES TO dvas_readonly;

COMMIT;
