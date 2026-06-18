-- 数据收益分配系统 V1.2 数据库设计与 ER 关系图 V1.0 导航结构更新版
-- PostgreSQL reference DDL. Output is simulation reference, not legal settlement.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS allocation_project (
    project_id varchar(64) NOT NULL PRIMARY KEY,
    project_name varchar(200) NOT NULL,
    scenario_name varchar(200),
    status varchar(32) NOT NULL,
    current_package_id varchar(64),
    current_algorithm_task_id varchar(64),
    current_allocation_id varchar(64),
    created_by varchar(64) NOT NULL,
    created_at timestamp NOT NULL,
    updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS nav_menu (
    menu_id varchar(64) NOT NULL PRIMARY KEY,
    parent_id varchar(64),
    menu_code varchar(64) NOT NULL,
    menu_name varchar(100) NOT NULL,
    module_code varchar(32) NOT NULL,
    route_path varchar(200) NOT NULL,
    menu_level smallint NOT NULL,
    sort_no int NOT NULL,
    p0_required boolean NOT NULL,
    p1_only boolean NOT NULL,
    status varchar(16) NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES nav_menu(menu_id)
);

CREATE TABLE IF NOT EXISTS permission (
    permission_id varchar(64) NOT NULL PRIMARY KEY,
    menu_id varchar(64) NOT NULL,
    permission_code varchar(100) NOT NULL,
    action_type varchar(32) NOT NULL,
    button_code varchar(64),
    description varchar(300),
    status varchar(16) NOT NULL,
    FOREIGN KEY (menu_id) REFERENCES nav_menu(menu_id)
);

CREATE TABLE IF NOT EXISTS user_account (
    user_id varchar(64) NOT NULL PRIMARY KEY,
    username varchar(80) NOT NULL,
    display_name varchar(100) NOT NULL,
    email varchar(200),
    password_hash varchar(255),
    status varchar(16) NOT NULL,
    created_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS role (
    role_id varchar(64) NOT NULL PRIMARY KEY,
    role_code varchar(64) NOT NULL,
    role_name varchar(100) NOT NULL,
    description varchar(300),
    status varchar(16) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_role (
    id varchar(64) NOT NULL PRIMARY KEY,
    user_id varchar(64) NOT NULL,
    role_id varchar(64) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user_account(user_id),
    FOREIGN KEY (role_id) REFERENCES role(role_id)
);

CREATE TABLE IF NOT EXISTS role_permission (
    id varchar(64) NOT NULL PRIMARY KEY,
    role_id varchar(64) NOT NULL,
    permission_id varchar(64) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (role_id) REFERENCES role(role_id),
    FOREIGN KEY (permission_id) REFERENCES permission(permission_id)
);

CREATE TABLE IF NOT EXISTS input_snapshot (
    snapshot_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    object_type varchar(64) NOT NULL,
    object_id varchar(64) NOT NULL,
    content_json jsonb NOT NULL,
    checksum varchar(128) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS upload_validation_result (
    validation_result_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    package_id varchar(64),
    is_valid boolean NOT NULL,
    error_code varchar(80),
    error_field varchar(200),
    error_message text,
    detail_json jsonb,
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS data_package (
    package_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    package_name varchar(200) NOT NULL,
    source_type varchar(32) NOT NULL,
    file_name varchar(255),
    file_size bigint,
    checksum varchar(128) NOT NULL,
    status varchar(32) NOT NULL,
    input_snapshot_id varchar(64) NOT NULL,
    validation_result_id varchar(64),
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (input_snapshot_id) REFERENCES input_snapshot(snapshot_id),
    FOREIGN KEY (validation_result_id) REFERENCES upload_validation_result(validation_result_id)
);

CREATE TABLE IF NOT EXISTS data_resource (
    resource_id varchar(64) NOT NULL PRIMARY KEY,
    package_id varchar(64) NOT NULL,
    project_id varchar(64) NOT NULL,
    resource_name varchar(200) NOT NULL,
    modality varchar(32) NOT NULL,
    field_count int NOT NULL,
    sample_count int NOT NULL,
    missing_rate numeric(10,6),
    include_in_calculation boolean NOT NULL,
    status varchar(32) NOT NULL,
    FOREIGN KEY (package_id) REFERENCES data_package(package_id),
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS data_resource_field (
    field_id varchar(64) NOT NULL PRIMARY KEY,
    resource_id varchar(64) NOT NULL,
    field_name varchar(200) NOT NULL,
    field_type varchar(64),
    is_sensitive boolean NOT NULL,
    missing_rate numeric(10,6),
    sample_preview_masked text,
    FOREIGN KEY (resource_id) REFERENCES data_resource(resource_id)
);

CREATE TABLE IF NOT EXISTS party (
    party_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    party_name varchar(200) NOT NULL,
    party_type varchar(40) NOT NULL,
    is_data_provider boolean NOT NULL,
    include_in_md_dshap boolean NOT NULL,
    credit_code varchar(100),
    contact_name varchar(100),
    description text,
    status varchar(32) NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS data_resource_party_relation (
    relation_id varchar(64) NOT NULL PRIMARY KEY,
    resource_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    split_ratio numeric(18,6) NOT NULL,
    is_primary_provider boolean NOT NULL,
    status varchar(32) NOT NULL,
    FOREIGN KEY (resource_id) REFERENCES data_resource(resource_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS quality_metric_template (
    metric_id varchar(64) NOT NULL PRIMARY KEY,
    metric_code varchar(64) NOT NULL,
    metric_name varchar(100) NOT NULL,
    parent_metric_code varchar(64),
    default_weight numeric(18,6) NOT NULL,
    metric_level smallint NOT NULL,
    status varchar(16) NOT NULL
);

CREATE TABLE IF NOT EXISTS quality_assessment (
    assessment_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    package_id varchar(64) NOT NULL,
    score numeric(8,4) NOT NULL,
    level varchar(32) NOT NULL,
    quality_factor numeric(18,6) NOT NULL CHECK (quality_factor > 0),
    parameter_snapshot_id varchar(64) NOT NULL,
    evidence_summary text,
    version_no int NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (package_id) REFERENCES data_package(package_id)
);

CREATE TABLE IF NOT EXISTS quality_score_detail (
    detail_id varchar(64) NOT NULL PRIMARY KEY,
    assessment_id varchar(64) NOT NULL,
    dimension_code varchar(64) NOT NULL,
    dimension_name varchar(100) NOT NULL,
    parent_dimension_code varchar(64),
    weight numeric(18,6) NOT NULL,
    score numeric(8,4) NOT NULL,
    evidence_text text,
    FOREIGN KEY (assessment_id) REFERENCES quality_assessment(assessment_id)
);

CREATE TABLE IF NOT EXISTS shuyuan_metering (
    metering_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    assessment_id varchar(64) NOT NULL,
    base_price numeric(18,6) NOT NULL CHECK (base_price > 0),
    scenario_coefficient numeric(18,6) NOT NULL CHECK (scenario_coefficient > 0),
    quality_coefficient numeric(18,6) NOT NULL CHECK (quality_coefficient > 0),
    technology_coefficient numeric(18,6) NOT NULL CHECK (technology_coefficient > 0),
    expert_coefficient numeric(18,6) NOT NULL CHECK (expert_coefficient > 0),
    development_coefficient numeric(18,6) NOT NULL CHECK (development_coefficient > 0),
    total_amount numeric(18,2) NOT NULL,
    parameter_snapshot_id varchar(64) NOT NULL,
    version_no int NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (assessment_id) REFERENCES quality_assessment(assessment_id)
);

CREATE TABLE IF NOT EXISTS shuyuan_metering_detail (
    detail_id varchar(64) NOT NULL PRIMARY KEY,
    metering_id varchar(64) NOT NULL,
    resource_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    call_count bigint NOT NULL CHECK (call_count >= 0),
    coefficient_json jsonb NOT NULL,
    metering_amount numeric(18,2) NOT NULL,
    FOREIGN KEY (metering_id) REFERENCES shuyuan_metering(metering_id),
    FOREIGN KEY (resource_id) REFERENCES data_resource(resource_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS contribution_record (
    contribution_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    valid_units numeric(18,6) NOT NULL CHECK (valid_units >= 0),
    usage_weight numeric(18,6) NOT NULL CHECK (usage_weight > 0),
    coverage_weight numeric(18,6) NOT NULL CHECK (coverage_weight > 0),
    scarcity_weight numeric(18,6) NOT NULL CHECK (scarcity_weight > 0),
    contribution_score numeric(18,6) NOT NULL,
    normalized_contribution numeric(18,6),
    parameter_snapshot_id varchar(64) NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS utility_function_snapshot (
    snapshot_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    utility_source varchar(100) NOT NULL,
    formula_text text NOT NULL,
    parameter_json jsonb NOT NULL,
    checksum varchar(128) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS utility_record (
    utility_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    task_key varchar(64) NOT NULL,
    normalized_contribution numeric(18,6) NOT NULL,
    quality_factor numeric(18,6) NOT NULL CHECK (quality_factor > 0),
    usage_factor numeric(18,6) NOT NULL CHECK (usage_factor > 0),
    scenario_factor numeric(18,6) NOT NULL CHECK (scenario_factor > 0),
    utility_value numeric(18,6) NOT NULL,
    utility_function_snapshot_id varchar(64) NOT NULL,
    trace_id varchar(64),
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id),
    FOREIGN KEY (utility_function_snapshot_id) REFERENCES utility_function_snapshot(snapshot_id)
);

CREATE TABLE IF NOT EXISTS utility_trace (
    trace_id varchar(64) NOT NULL PRIMARY KEY,
    utility_id varchar(64) NOT NULL,
    formula_text text NOT NULL,
    input_json jsonb NOT NULL,
    output_json jsonb NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (utility_id) REFERENCES utility_record(utility_id)
);

CREATE TABLE IF NOT EXISTS md_dshap_task (
    task_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    algorithm_mode varchar(32) NOT NULL,
    baseline_enabled boolean NOT NULL,
    participant_set_json jsonb NOT NULL,
    task_set_json jsonb NOT NULL,
    utility_function_snapshot_id varchar(64) NOT NULL,
    seed bigint NOT NULL,
    sample_rounds int,
    epsilon numeric(18,8),
    status varchar(32) NOT NULL,
    algorithm_version varchar(64) NOT NULL,
    parameter_snapshot_id varchar(64) NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (utility_function_snapshot_id) REFERENCES utility_function_snapshot(snapshot_id)
);

CREATE TABLE IF NOT EXISTS md_dshap_result (
    result_id varchar(64) NOT NULL PRIMARY KEY,
    task_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    participant_weight numeric(18,6) NOT NULL,
    normalized_weight numeric(18,6) NOT NULL,
    baseline_weight numeric(18,6),
    weight_diff numeric(18,6),
    task_level_weight_json jsonb,
    approximation_note text,
    FOREIGN KEY (task_id) REFERENCES md_dshap_task(task_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS md_dshap_marginal_trace (
    trace_id varchar(64) NOT NULL PRIMARY KEY,
    task_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    task_key varchar(64) NOT NULL,
    iteration_no int,
    coalition_before jsonb NOT NULL,
    v_before numeric(18,6) NOT NULL,
    v_after numeric(18,6) NOT NULL,
    marginal_contribution numeric(18,6) NOT NULL,
    seed bigint,
    created_at timestamp NOT NULL,
    FOREIGN KEY (task_id) REFERENCES md_dshap_task(task_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS algorithm_audit_snapshot (
    snapshot_id varchar(64) NOT NULL PRIMARY KEY,
    task_id varchar(64) NOT NULL,
    project_id varchar(64) NOT NULL,
    input_snapshot_json jsonb NOT NULL,
    parameter_snapshot_json jsonb NOT NULL,
    output_snapshot_json jsonb NOT NULL,
    assumption_text text,
    checksum varchar(128) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (task_id) REFERENCES md_dshap_task(task_id),
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS allocation_scenario (
    allocation_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    total_revenue numeric(18,2) NOT NULL CHECK (total_revenue >= 0),
    currency varchar(16) NOT NULL,
    priority_allocation_amount numeric(18,2) NOT NULL CHECK (priority_allocation_amount >= 0),
    data_provider_revenue_pool numeric(18,2) NOT NULL CHECK (data_provider_revenue_pool >= 0),
    allocation_mode varchar(40) NOT NULL,
    weight_task_id varchar(64),
    status varchar(32) NOT NULL,
    locked_by varchar(64),
    locked_at timestamp,
    version_no int NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (weight_task_id) REFERENCES md_dshap_task(task_id)
);

CREATE TABLE IF NOT EXISTS allocation_priority_item (
    item_id varchar(64) NOT NULL PRIMARY KEY,
    allocation_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    value_type varchar(16) NOT NULL,
    priority_amount numeric(18,2),
    priority_ratio numeric(18,6),
    priority int NOT NULL,
    basis_text text,
    FOREIGN KEY (allocation_id) REFERENCES allocation_scenario(allocation_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS contract_constraint (
    constraint_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    constraint_name varchar(200) NOT NULL,
    constraint_type varchar(40) NOT NULL,
    value_type varchar(16) NOT NULL,
    constraint_value numeric(18,6) NOT NULL,
    priority int NOT NULL,
    status varchar(32) NOT NULL,
    description text,
    version_no int NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS allocation_result (
    result_id varchar(64) NOT NULL PRIMARY KEY,
    allocation_id varchar(64) NOT NULL,
    project_id varchar(64) NOT NULL,
    party_id varchar(64) NOT NULL,
    raw_weight numeric(18,6) NOT NULL,
    normalized_weight numeric(18,6) NOT NULL,
    pre_constraint_amount numeric(18,2) NOT NULL,
    post_constraint_amount numeric(18,2) NOT NULL,
    constraint_adjustment_reason text,
    rounding_delta numeric(18,2),
    final_status varchar(32) NOT NULL,
    FOREIGN KEY (allocation_id) REFERENCES allocation_scenario(allocation_id),
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS constraint_apply_trace (
    trace_id varchar(64) NOT NULL PRIMARY KEY,
    allocation_id varchar(64) NOT NULL,
    constraint_id varchar(64),
    party_id varchar(64) NOT NULL,
    before_amount numeric(18,2) NOT NULL,
    after_amount numeric(18,2) NOT NULL,
    adjustment_amount numeric(18,2) NOT NULL,
    reason text NOT NULL,
    step_no int NOT NULL,
    FOREIGN KEY (allocation_id) REFERENCES allocation_scenario(allocation_id),
    FOREIGN KEY (constraint_id) REFERENCES contract_constraint(constraint_id),
    FOREIGN KEY (party_id) REFERENCES party(party_id)
);

CREATE TABLE IF NOT EXISTS report_record (
    report_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64) NOT NULL,
    report_type varchar(40) NOT NULL,
    file_name varchar(255) NOT NULL,
    file_format varchar(16) NOT NULL,
    file_path varchar(500) NOT NULL,
    checksum varchar(128) NOT NULL,
    source_snapshot_id varchar(64),
    created_by varchar(64) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS export_file (
    file_id varchar(64) NOT NULL PRIMARY KEY,
    report_id varchar(64) NOT NULL,
    file_name varchar(255) NOT NULL,
    file_type varchar(40) NOT NULL,
    field_scope_json jsonb NOT NULL,
    checksum varchar(128) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (report_id) REFERENCES report_record(report_id)
);

CREATE TABLE IF NOT EXISTS snapshot_store (
    snapshot_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64),
    snapshot_type varchar(40) NOT NULL,
    object_type varchar(64) NOT NULL,
    object_id varchar(64) NOT NULL,
    content_json jsonb NOT NULL,
    checksum varchar(128) NOT NULL,
    created_by varchar(64) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id varchar(64) NOT NULL PRIMARY KEY,
    project_id varchar(64),
    module_code varchar(32) NOT NULL,
    menu_code varchar(64),
    operation_type varchar(32) NOT NULL,
    object_type varchar(64) NOT NULL,
    object_id varchar(64),
    operator_id varchar(64) NOT NULL,
    before_value_json jsonb,
    after_value_json jsonb,
    input_snapshot_id varchar(64),
    parameter_snapshot_id varchar(64),
    result_snapshot_id varchar(64),
    status varchar(32) NOT NULL,
    failure_reason text,
    created_at timestamp NOT NULL,
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE TABLE IF NOT EXISTS system_parameter (
    parameter_id varchar(64) NOT NULL PRIMARY KEY,
    parameter_code varchar(100) NOT NULL,
    parameter_name varchar(200) NOT NULL,
    parameter_type varchar(40) NOT NULL,
    default_value jsonb NOT NULL,
    current_value jsonb NOT NULL,
    scope varchar(32) NOT NULL,
    is_editable boolean NOT NULL,
    version_no int NOT NULL,
    updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS parameter_version (
    version_id varchar(64) NOT NULL PRIMARY KEY,
    parameter_id varchar(64) NOT NULL,
    project_id varchar(64),
    version_no int NOT NULL,
    value_json jsonb NOT NULL,
    effective_from timestamp NOT NULL,
    created_by varchar(64) NOT NULL,
    created_at timestamp NOT NULL,
    FOREIGN KEY (parameter_id) REFERENCES system_parameter(parameter_id),
    FOREIGN KEY (project_id) REFERENCES allocation_project(project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_status_created ON allocation_project (status, created_at); -- 系统首页项目状态筛选。
CREATE UNIQUE INDEX IF NOT EXISTS uk_nav_menu_code ON nav_menu (menu_code); -- 保证更新后的导航编码唯一。
CREATE INDEX IF NOT EXISTS idx_nav_parent_sort ON nav_menu (parent_id, sort_no); -- 左侧菜单按父级和排序加载。
CREATE UNIQUE INDEX IF NOT EXISTS uk_permission_code ON permission (permission_code); -- 按钮级权限唯一。
CREATE UNIQUE INDEX IF NOT EXISTS uk_party_project_name ON party (project_id, party_name); -- 同一项目参与方名称唯一。
CREATE INDEX IF NOT EXISTS idx_party_type_md ON party (project_id, party_type, include_in_md_dshap); -- 构造 MD-DShap 参与方集合。
CREATE INDEX IF NOT EXISTS idx_package_project_status ON data_package (project_id, status); -- 数据接入列表。
CREATE INDEX IF NOT EXISTS idx_resource_package_modality ON data_resource (package_id, modality); -- 资源列表和模态筛选。
CREATE UNIQUE INDEX IF NOT EXISTS uk_resource_party ON data_resource_party_relation (resource_id, party_id); -- 同一资源-主体关系唯一。
CREATE INDEX IF NOT EXISTS idx_quality_project_version ON quality_assessment (project_id, version_no); -- 质量评估历史版本。
CREATE INDEX IF NOT EXISTS idx_metering_project_version ON shuyuan_metering (project_id, version_no); -- 数元计量历史版本。
CREATE INDEX IF NOT EXISTS idx_contribution_project_party ON contribution_record (project_id, party_id); -- 贡献度结果查询。
CREATE INDEX IF NOT EXISTS idx_utility_project_party_task ON utility_record (project_id, party_id, task_key); -- 效用值和任务维度查询。
CREATE INDEX IF NOT EXISTS idx_mds_project_status_mode ON md_dshap_task (project_id, status, algorithm_mode, created_at); -- 算法任务列表。
CREATE UNIQUE INDEX IF NOT EXISTS uk_mds_result_task_party ON md_dshap_result (task_id, party_id); -- 一个任务中每个主体一条权重结果。
CREATE INDEX IF NOT EXISTS idx_mds_trace_task_party ON md_dshap_marginal_trace (task_id, party_id, task_key); -- 边际贡献分页筛选。
CREATE INDEX IF NOT EXISTS idx_alloc_project_status ON allocation_scenario (project_id, status, version_no); -- 分配方案列表。
CREATE UNIQUE INDEX IF NOT EXISTS uk_alloc_result_party ON allocation_result (allocation_id, party_id); -- 一个分配场景中每个参与方一条结果。
CREATE INDEX IF NOT EXISTS idx_constraint_project_party ON contract_constraint (project_id, party_id, status, priority); -- 约束执行时按主体和优先级读取。
CREATE INDEX IF NOT EXISTS idx_report_project_type_created ON report_record (project_id, report_type, created_at); -- 报告历史记录。
CREATE INDEX IF NOT EXISTS idx_audit_project_module_time ON audit_log (project_id, module_code, created_at); -- 审计日志筛选。
CREATE INDEX IF NOT EXISTS idx_snapshot_project_type_object ON snapshot_store (project_id, snapshot_type, object_type, object_id); -- 快照追溯。
CREATE UNIQUE INDEX IF NOT EXISTS uk_parameter_code ON system_parameter (parameter_code); -- 参数编码唯一。

-- Updated left navigation seed data
INSERT INTO nav_menu (menu_id,parent_id,menu_code,menu_name,module_code,route_path,menu_level,sort_no,p0_required,p1_only,status) VALUES
    ('MENU_SYS_HOME', NULL, 'NAV_SYS_HOME', '系统首页', 'SYS', '/dashboard', 1, 1, TRUE, FALSE, 'ENABLED'),
    ('NAV_DATA', NULL, 'NAV_DATA', '数据管理', 'DATA', '/data', 1, 2, TRUE, FALSE, 'ENABLED'),
    ('NAV_MEASURE', NULL, 'NAV_MEASURE', '数元贡献度计量', 'QUAL', '/measure', 1, 3, TRUE, FALSE, 'ENABLED'),
    ('NAV_ALLOC', NULL, 'NAV_ALLOC', '收益分配计算', 'MDS', '/allocation', 1, 4, TRUE, FALSE, 'ENABLED'),
    ('NAV_REPORT', NULL, 'NAV_REPORT', '报告生成与导出', 'REP', '/reports', 1, 5, TRUE, FALSE, 'ENABLED'),
    ('NAV_SYSTEM', NULL, 'NAV_SYSTEM', '系统管理', 'PARAM', '/system', 1, 6, TRUE, FALSE, 'ENABLED'),
    ('NAV_DATA_PACKAGE', 'NAV_DATA', 'NAV_DATA_PACKAGE', '数据接入管理', 'DATA', '/data/packages', 2, 5, TRUE, FALSE, 'ENABLED'),
    ('NAV_DATA_RESOURCE', 'NAV_DATA', 'NAV_DATA_RESOURCE', '数据资源管理', 'RES', '/data/resources', 2, 6, TRUE, FALSE, 'ENABLED'),
    ('NAV_DATA_PARTY', 'NAV_DATA', 'NAV_DATA_PARTY', '参与方管理', 'PARTY', '/data/parties', 2, 7, TRUE, FALSE, 'ENABLED'),
    ('NAV_MEASURE_QUALITY', 'NAV_MEASURE', 'NAV_MEASURE_QUALITY', '质量评估管理', 'QUAL', '/measure/quality', 2, 8, TRUE, FALSE, 'ENABLED'),
    ('NAV_MEASURE_SHUYUAN', 'NAV_MEASURE', 'NAV_MEASURE_SHUYUAN', '数元计量管理', 'DU', '/measure/shuyuan', 2, 9, TRUE, FALSE, 'ENABLED'),
    ('NAV_MEASURE_UTILITY', 'NAV_MEASURE', 'NAV_MEASURE_UTILITY', '贡献度与效用计算', 'UTIL', '/measure/utility', 2, 10, TRUE, FALSE, 'ENABLED'),
    ('NAV_ALLOC_MDS', 'NAV_ALLOC', 'NAV_ALLOC_MDS', 'MD-DShap 计算管理', 'MDS', '/allocation/md-dshap', 2, 11, TRUE, FALSE, 'ENABLED'),
    ('NAV_ALLOC_SIMULATION', 'NAV_ALLOC', 'NAV_ALLOC_SIMULATION', '收益分配模拟', 'ALLOC', '/allocation/simulation', 2, 12, TRUE, FALSE, 'ENABLED'),
    ('NAV_ALLOC_CONSTRAINT', 'NAV_ALLOC', 'NAV_ALLOC_CONSTRAINT', '合同约束管理', 'CONS', '/allocation/constraints', 2, 13, TRUE, FALSE, 'ENABLED'),
    ('NAV_REPORT_EXPORT', 'NAV_REPORT', 'NAV_REPORT_EXPORT', '报告生成与导出', 'REP', '/reports', 2, 14, TRUE, FALSE, 'ENABLED'),
    ('NAV_SYSTEM_PARAMETER', 'NAV_SYSTEM', 'NAV_SYSTEM_PARAMETER', '参数配置', 'PARAM', '/system/parameters', 2, 15, TRUE, FALSE, 'ENABLED'),
    ('NAV_SYSTEM_USER', 'NAV_SYSTEM', 'NAV_SYSTEM_USER', '用户与权限管理（P1）', 'USER', '/system/users', 2, 16, FALSE, TRUE, 'ENABLED'),
    ('NAV_SYSTEM_AUDIT', 'NAV_SYSTEM', 'NAV_SYSTEM_AUDIT', '审计日志管理', 'AUD', '/system/audit', 2, 17, TRUE, FALSE, 'ENABLED')
ON CONFLICT (menu_code) DO NOTHING;
