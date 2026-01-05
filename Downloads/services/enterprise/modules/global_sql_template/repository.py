from config import GLOBAL_SQL_TEMPLATE_COL
from database.mongo import MongoDB
from modules.global_sql_template.models.entities import GlobalSqlTemplate

class GlobalSqlTemplateRepository:
    def get_templates(self, query: dict) -> list[GlobalSqlTemplate]:
        return [
            GlobalSqlTemplate(id=str(template["_id"]), **template) 
            for template in MongoDB.find(GLOBAL_SQL_TEMPLATE_COL, query)
        ]