"""
数据库配置 YAML 导入导出模块
"""
import yaml
import io
import zipfile
from typing import Dict, Any, List, Optional, Tuple
from pydantic import ValidationError
from datetime import datetime

from app.models.schemas import DatabaseConfigCreate


# 支持的数据库类型
DB_TYPES = ["postgresql", "opengauss", "gaussdb"]

# 支持的连接方式
CONNECTION_METHODS = ["asyncpg", "psycopg2", "gsql", "jdbc"]

# 支持的部署形态
DEPLOYMENT_MODES = ["centralized", "distributed"]


class DbConfigYamlParser:
    """YAML 数据库配置解析器"""

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
            errors.append("配置名称不能为空")

        if "db_type" not in metadata:
            errors.append("数据库类型不能为空")
        elif metadata["db_type"] not in DB_TYPES:
            errors.append(f"数据库类型 '{metadata['db_type']}' 不支持，支持的类型: {DB_TYPES}")

        if "connection_method" not in metadata:
            errors.append("连接方式不能为空")
        elif metadata["connection_method"] not in CONNECTION_METHODS:
            errors.append(f"连接方式 '{metadata['connection_method']}' 不支持，支持的方式: {CONNECTION_METHODS}")

        if "connection" not in data:
            errors.append("缺少 connection 字段")
        else:
            connection = data["connection"]
            if "host" not in connection or not connection["host"]:
                errors.append("主机地址不能为空")
            if "port" not in connection:
                errors.append("端口不能为空")
            elif not isinstance(connection["port"], int) or connection["port"] < 1:
                errors.append("端口必须是正整数")
            if "database" not in connection or not connection["database"]:
                errors.append("数据库名不能为空")
            if "username" not in connection or not connection["username"]:
                errors.append("用户名不能为空")

        return len(errors) == 0, errors

    def parse_yaml_to_config(self, yaml_content: str) -> Tuple[Optional[DatabaseConfigCreate], List[str]]:
        """解析 YAML 内容为数据库配置对象"""
        self.errors = []

        try:
            data = yaml.safe_load(yaml_content)
        except yaml.YAMLError as e:
            return None, [f"YAML 解析错误: {str(e)}"]

        if not data:
            return None, ["YAML 内容为空"]

        # 验证结构
        valid, errors = self.validate_yaml_structure(data)
        if not valid:
            return None, errors

        # 提取数据
        metadata = data.get("metadata", {})
        connection = data.get("connection", {})
        jdbc = data.get("jdbc", {})

        # 创建配置对象
        try:
            config = DatabaseConfigCreate(
                name=metadata.get("name"),
                db_type=metadata.get("db_type"),
                connection_method=metadata.get("connection_method"),
                deployment_mode=metadata.get("deployment_mode", "centralized"),
                host=connection.get("host"),
                port=connection.get("port"),
                database=connection.get("database"),
                username=connection.get("username"),
                password=connection.get("password", ""),
                jdbc_driver_path=jdbc.get("driver_path") if metadata.get("connection_method") == "jdbc" else None,
            )
            return config, []
        except ValidationError as e:
            return None, [f"配置数据验证错误: {str(e)}"]

    def config_to_yaml(self, config: Dict[str, Any]) -> str:
        """将配置对象转换为 YAML"""
        yaml_data = {
            "metadata": {
                "name": config.get("name"),
                "db_type": config.get("db_type"),
                "connection_method": config.get("connection_method"),
                "deployment_mode": config.get("deployment_mode", "centralized"),
            },
            "connection": {
                "host": config.get("host"),
                "port": config.get("port"),
                "database": config.get("database"),
                "username": config.get("username"),
                "password": config.get("password", ""),  # 导出时保留密码，但可以为空
            },
        }

        # JDBC 配置
        if config.get("connection_method") == "jdbc" and config.get("jdbc_driver_path"):
            yaml_data["jdbc"] = {
                "driver_path": config.get("jdbc_driver_path"),
            }

        # 添加导出时间注释
        export_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        header = f"# 数据库配置文件\n# 导出时间: {export_time}\n# 来源: SWAT Fault Inject Platform\n\n"

        yaml_content = yaml.dump(yaml_data, default_flow_style=False, allow_unicode=True, sort_keys=False)
        return header + yaml_content


def create_zip_from_configs(configs: List[Dict[str, Any]]) -> bytes:
    """将多个配置打包为 ZIP"""
    parser = DbConfigYamlParser()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for config in configs:
            yaml_content = parser.config_to_yaml(config)
            # 文件名使用配置名称（替换特殊字符）
            safe_name = config.get("name", "unknown").replace(" ", "_").replace("/", "_")
            filename = f"db_config_{safe_name}.yaml"
            zip_file.writestr(filename, yaml_content)

    zip_buffer.seek(0)
    return zip_buffer.getvalue()