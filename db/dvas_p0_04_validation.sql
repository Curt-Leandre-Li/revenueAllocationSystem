-- DVAS P0 validation SQL
-- Usage: psql -U dvas_app -d dvas_p0 -f dvas_p0_04_validation.sql
SET search_path TO dvas, public;

DROP TABLE IF EXISTS pg_temp.validation_checks;

CREATE TEMP TABLE validation_checks AS
WITH checks AS (
    SELECT
        '01_schema_exists' AS check_item,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dvas')
             THEN 'PASS' ELSE 'FAIL' END AS status,
        (SELECT COUNT(*)::text FROM information_schema.schemata WHERE schema_name = 'dvas') AS actual_value,
        'schema dvas exists' AS expected
    UNION ALL
    SELECT
        '02_core_table_count',
        CASE WHEN COUNT(*) >= 38 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        '>= 38 base tables'
    FROM information_schema.tables
    WHERE table_schema = 'dvas' AND table_type = 'BASE TABLE'
    UNION ALL
    SELECT
        '03_nav_first_level',
        CASE WHEN COUNT(*) = 6 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'six first-level navigation nodes'
    FROM nav_menu
    WHERE parent_id IS NULL
      AND menu_name IN ('系统首页','数据管理','数元贡献度计量','收益分配计算','报告生成与导出','系统管理')
    UNION ALL
    SELECT
        '04_nav_second_level',
        CASE WHEN COUNT(*) >= 12 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'corresponding second-level pages'
    FROM nav_menu
    WHERE parent_id IS NOT NULL
    UNION ALL
    SELECT
        '05_permission_actions',
        CASE WHEN COUNT(*) >= 40
              AND COUNT(*) FILTER (WHERE button_code IS NOT NULL AND button_code <> '') >= 1
             THEN 'PASS' ELSE 'FAIL' END,
        jsonb_build_object(
            'permissions', COUNT(*),
            'button_permissions', COUNT(*) FILTER (WHERE button_code IS NOT NULL AND button_code <> '')
        )::text,
        'permission has button/action permissions'
    FROM permission
    UNION ALL
    SELECT
        '06_local_operator',
        CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'user_account contains local_operator'
    FROM user_account
    WHERE username = 'local_operator' AND operator_code = 'local_operator'
    UNION ALL
    SELECT
        '07_demo_project_status',
        CASE WHEN COUNT(*) = 1
              AND MAX(status) IN ('EXPORTED','CONFIRMED','ALLOCATED')
             THEN 'PASS' ELSE 'FAIL' END,
        COALESCE(MAX(status), 'missing'),
        'PRJ_DEMO_001 is EXPORTED or complete enough for exported state'
    FROM allocation_project
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '08_input_snapshot',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'input_snapshot has records'
    FROM input_snapshot
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '09_data_package',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'data_package has records'
    FROM data_package
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '10_data_resource',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'data_resource has records'
    FROM data_resource
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '11_party',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'party has records'
    FROM party
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '12_quality_assessment',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'quality_assessment has records'
    FROM quality_assessment
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '13_shuyuan_metering',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'shuyuan_metering has records'
    FROM shuyuan_metering
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '14_contribution_record',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'contribution_record has records'
    FROM contribution_record
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '15_utility_record',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'utility_record has records'
    FROM utility_record
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '16_md_dshap_task_mode',
        CASE WHEN COUNT(*) >= 1
              AND COUNT(*) FILTER (WHERE algorithm_mode = 'MD_DSHAP') = COUNT(*)
             THEN 'PASS' ELSE 'FAIL' END,
        jsonb_build_object(
            'tasks', COUNT(*),
            'md_dshap_tasks', COUNT(*) FILTER (WHERE algorithm_mode = 'MD_DSHAP')
        )::text,
        'md_dshap_task exists and algorithm_mode is MD_DSHAP'
    FROM md_dshap_task
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '17_md_dshap_weight_sum',
        CASE WHEN ABS(COALESCE(SUM(normalized_weight), 0) - 1.000000) <= 0.000001
             THEN 'PASS' ELSE 'FAIL' END,
        COALESCE(ROUND(SUM(normalized_weight), 6)::text, 'missing'),
        'weight sum = 1 within 0.000001'
    FROM md_dshap_result
    WHERE task_id = 'MDS_TASK_DEMO_001'
    UNION ALL
    SELECT
        '18_allocation_scenario_total_revenue',
        CASE WHEN COUNT(*) >= 1 AND COALESCE(SUM(total_revenue), 0) > 0
             THEN 'PASS' ELSE 'FAIL' END,
        COALESCE(SUM(total_revenue)::text, 'missing'),
        'allocation_scenario has total revenue'
    FROM allocation_scenario
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '19_allocation_result_amount_sum',
        CASE WHEN ABS(
              COALESCE((SELECT SUM(post_constraint_amount) FROM allocation_result WHERE allocation_id = 'ALLOC_DEMO_001'), 0)
              - COALESCE((SELECT total_revenue FROM allocation_scenario WHERE allocation_id = 'ALLOC_DEMO_001'), 0)
             ) <= 0.01
             THEN 'PASS' ELSE 'FAIL' END,
        jsonb_build_object(
            'result_sum', COALESCE((SELECT SUM(post_constraint_amount) FROM allocation_result WHERE allocation_id = 'ALLOC_DEMO_001'), 0),
            'total_revenue', COALESCE((SELECT total_revenue FROM allocation_scenario WHERE allocation_id = 'ALLOC_DEMO_001'), 0)
        )::text,
        'allocation_result sum equals total revenue within 0.01'
    UNION ALL
    SELECT
        '20_report_record',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'report_record has records'
    FROM report_record
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '21_export_file_checksum',
        CASE WHEN COUNT(*) >= 1
              AND COUNT(*) FILTER (WHERE checksum IS NOT NULL AND checksum <> '') = COUNT(*)
             THEN 'PASS' ELSE 'FAIL' END,
        jsonb_build_object(
            'export_files', COUNT(*),
            'checksum_present', COUNT(*) FILTER (WHERE checksum IS NOT NULL AND checksum <> '')
        )::text,
        'export_file has records and non-empty checksum'
    FROM export_file
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '22_audit_log',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'audit_log has records'
    FROM audit_log
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '23_snapshot_store',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'snapshot_store has records'
    FROM snapshot_store
    WHERE project_id = 'PRJ_DEMO_001'
    UNION ALL
    SELECT
        '24_algorithm_audit_snapshot',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        COUNT(*)::text,
        'algorithm_audit_snapshot has records'
    FROM algorithm_audit_snapshot
    WHERE project_id = 'PRJ_DEMO_001'
)
SELECT check_item, status, actual_value, expected
FROM checks;

SELECT check_item, status, actual_value, expected
FROM validation_checks
ORDER BY check_item;

-- Manual inspection detail for screenshots.
SELECT
    p.party_name,
    p.party_type,
    COALESCE(mr.normalized_weight, 0) AS md_dshap_weight,
    ar.pre_constraint_amount,
    ar.post_constraint_amount,
    ar.constraint_adjustment_reason
FROM allocation_result ar
JOIN party p ON p.party_id = ar.party_id
LEFT JOIN md_dshap_result mr ON mr.party_id = ar.party_id AND mr.task_id = 'MDS_TASK_DEMO_001'
WHERE ar.allocation_id = 'ALLOC_DEMO_001'
ORDER BY ar.post_constraint_amount DESC;

DO $$
DECLARE
    failed_count int;
BEGIN
    SELECT COUNT(*) INTO failed_count
    FROM validation_checks
    WHERE status <> 'PASS';

    IF failed_count > 0 THEN
        RAISE EXCEPTION 'DVAS P0 validation failed: % check(s) failed', failed_count;
    END IF;
END
$$;
