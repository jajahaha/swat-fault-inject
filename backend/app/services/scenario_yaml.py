"""
故障场景 YAML 导入导出模块
"""
import yaml
import io
import zipfile
from typing import Dict, Any, List, Optional, Tuple
from pydantic import ValidationError
from datetime import datetime

from app.models.schemas import (
    FaultScenarioCreate,
    SetupScript,
    RunScript,
    CleanupScript,
)


# 场景类型定义
SCENARIO_TYPES = [
    "high_concurrency",
    "connection_exhaustion",
    "slow_query",
    "io_pressure",
    "custom",
]


class ScenarioYamlParser:
    """YAML 场景解析器"""

    def __init__(self):
        self.errors = []

    def validate_yaml_structure(self, data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """验证 YAML 结构"""
        errors = []

        # 检查必需字段
        if "metadata" not in data:
            errors.append("缺少 metadata 字段")
            return False, errors

        metadata = data["metadata"]

        if "name" not in metadata or not metadata["name"]:
            errors.append("场景名称不能为空")

        if "type" not in metadata:
            errors.append("场景类型不能为空")
        elif metadata["type"] not in SCENARIO_TYPES:
            errors.append(f"场景类型 '{metadata['type']}' 不支持，支持的类型: {SCENARIO_TYPES}")

        if "config" not in data:
            errors.append("缺少 config 字段")
        else:
            config = data["config"]
            # 验证通用配置参数
            if "concurrency" in config:
                if not isinstance(config["concurrency"], int) or config["concurrency"] < 1:
                    errors.append("concurrency 必须是正整数")

            if "duration_seconds" in config:
                if not isinstance(config["duration_seconds"], int) or config["duration_seconds"] < 1:
                    errors.append("duration_seconds 必须是正整数")

        return len(errors) == 0, errors

    def parse_yaml_to_scenario(self, yaml_content: str) -> Tuple[Optional[FaultScenarioCreate], List[str]]:
        """解析 YAML 内容为场景对象"""
        self.errors = []

        try:
            data = yaml.safe_load(yaml_content)
        except yaml.YAMLError as e:
            return None, [f"YAML 解析错误: {str(e)}"]

        # 验证结构
        valid, errors = self.validate_yaml_structure(data)
        if not valid:
            return None, errors

        # 提取数据
        metadata = data.get("metadata", {})
        config = data.get("config", {})

        # 解析 setup scripts
        setup_scripts = []
        setup_data = data.get("setup", {})
        if setup_data and "scripts" in setup_data:
            for script in setup_data["scripts"]:
                try:
                    setup_scripts.append(SetupScript(
                        type=script.get("type", "sql"),
                        mode=script.get("mode", "all"),
                        description=script.get("description"),
                        content=script.get("content", ""),
                        timeout=script.get("timeout", 30),
                    ))
                except Exception as e:
                    errors.append(f"Setup script 解析错误: {str(e)}")

        # 解析 cleanup scripts
        cleanup_scripts = []
        cleanup_data = data.get("cleanup", {})
        if cleanup_data and "scripts" in cleanup_data:
            for script in cleanup_data["scripts"]:
                try:
                    cleanup_scripts.append(CleanupScript(
                        type=script.get("type", "sql"),
                        mode=script.get("mode", "all"),
                        description=script.get("description"),
                        content=script.get("content", ""),
                        timeout=script.get("timeout", 10),
                    ))
                except Exception as e:
                    errors.append(f"Cleanup script 解析错误: {str(e)}")

        # 解析 run scripts (运行环节脚本)
        run_scripts = []
        run_data = data.get("run", {})
        if run_data and "scripts" in run_data:
            for script in run_data["scripts"]:
                try:
                    run_scripts.append(RunScript(
                        type=script.get("type", "sql"),
                        mode=script.get("mode", "all"),
                        description=script.get("description"),
                        content=script.get("content", ""),
                        timeout=script.get("timeout", 60),
                        iterations=script.get("iterations", 1),
                        interval_ms=script.get("interval_ms", 100),
                    ))
                except Exception as e:
                    errors.append(f"Run script 解析错误: {str(e)}")

        if errors:
            return None, errors

        # 创建场景对象
        try:
            scenario = FaultScenarioCreate(
                name=metadata.get("name"),
                type=metadata.get("type"),
                category1=metadata.get("category1"),
                category2=metadata.get("category2"),
                category3=metadata.get("category3"),
                description=metadata.get("description"),
                config=config,
                setup_scripts=setup_scripts if setup_scripts else None,
                run_scripts=run_scripts if run_scripts else None,
                cleanup_scripts=cleanup_scripts if cleanup_scripts else None,
                setup_timeout=setup_data.get("timeout", 60) if setup_data else 60,
                run_timeout=run_data.get("timeout", 120) if run_data else 120,
                cleanup_timeout=cleanup_data.get("timeout", 30) if cleanup_data else 30,
            )
            return scenario, []
        except ValidationError as e:
            return None, [f"场景数据验证错误: {str(e)}"]

    def scenario_to_yaml(self, scenario: Dict[str, Any]) -> str:
        """将场景对象转换为 YAML"""
        yaml_data = {
            "metadata": {
                "name": scenario.get("name"),
                "type": scenario.get("type"),
                "category1": scenario.get("category1"),
                "category2": scenario.get("category2"),
                "category3": scenario.get("category3"),
                "description": scenario.get("description"),
            },
            "config": scenario.get("config", {}),
        }

        # 添加 setup scripts
        setup_scripts = scenario.get("setup_scripts", [])
        if setup_scripts:
            yaml_data["setup"] = {
                "timeout": scenario.get("setup_timeout", 60),
                "scripts": [
                    {
                        "type": s.get("type", "sql"),
                        "mode": s.get("mode", "all"),
                        "description": s.get("description"),
                        "content": s.get("content"),
                        "timeout": s.get("timeout", 30),
                    }
                    for s in setup_scripts
                ],
            }

        # 添加 run scripts (运行环节脚本)
        run_scripts = scenario.get("run_scripts", [])
        if run_scripts:
            yaml_data["run"] = {
                "timeout": scenario.get("run_timeout", 120),
                "scripts": [
                    {
                        "type": s.get("type", "sql"),
                        "mode": s.get("mode", "all"),
                        "description": s.get("description"),
                        "content": s.get("content"),
                        "timeout": s.get("timeout", 60),
                        "iterations": s.get("iterations", 1),
                        "interval_ms": s.get("interval_ms", 100),
                    }
                    for s in run_scripts
                ],
            }

        # 添加 cleanup scripts
        cleanup_scripts = scenario.get("cleanup_scripts", [])
        if cleanup_scripts:
            yaml_data["cleanup"] = {
                "timeout": scenario.get("cleanup_timeout", 30),
                "scripts": [
                    {
                        "type": s.get("type", "sql"),
                        "mode": s.get("mode", "all"),
                        "description": s.get("description"),
                        "content": s.get("content"),
                        "timeout": s.get("timeout", 10),
                    }
                    for s in cleanup_scripts
                ],
            }

        # 添加导出时间注释
        export_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        header = f"# 故障场景配置文件\n# 导出时间: {export_time}\n# 来源: SWAT Fault Inject Platform\n\n"

        yaml_content = yaml.dump(yaml_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        return header + yaml_content


def create_zip_from_scenarios(scenarios: List[Dict[str, Any]]) -> bytes:
    """将多个场景打包为 ZIP"""
    parser = ScenarioYamlParser()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for scenario in scenarios:
            yaml_content = parser.scenario_to_yaml(scenario)
            # 文件名使用场景名称（替换特殊字符）
            safe_name = scenario.get("name", "unknown").replace(" ", "_").replace("/", "_")
            filename = f"scenario_{safe_name}.yaml"
            zip_file.writestr(filename, yaml_content)

    zip_buffer.seek(0)
    return zip_buffer.getvalue()