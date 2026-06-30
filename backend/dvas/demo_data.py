DEMO_CASES = {
    "lung_screening_demo": {
        "demo_case_id": "lung_screening_demo",
        "package_name": "肺癌早筛示例数据包",
        "scenario_name": "肺癌早筛数据收益分配示例项目",
        "description": "用于本地演示的脱敏示例数据，不代表真实医疗生产数据。",
        "revenue_pool": 1200000,
        "resources": [
            {
                "resource_name": "影像特征数据集",
                "modality": "IMAGE",
                "field_count": 32,
                "sample_count": 240,
                "provider_party_name": "示例数据源主体A",
            },
            {
                "resource_name": "随访结构化记录",
                "modality": "TABULAR",
                "field_count": 18,
                "sample_count": 240,
                "provider_party_name": "示例数据源主体B",
            },
        ],
        "parties": [
            {
                "party_name": "示例数据源主体A",
                "party_type": "DATA_PROVIDER",
                "include_in_md_dshap": True,
            },
            {
                "party_name": "示例数据源主体B",
                "party_type": "DATA_PROVIDER",
                "include_in_md_dshap": True,
            },
            {
                "party_name": "示例运营服务方",
                "party_type": "OPERATOR",
                "include_in_md_dshap": False,
            },
        ],
    }
}


def get_demo_case(demo_case_id):
    return DEMO_CASES.get(demo_case_id)
