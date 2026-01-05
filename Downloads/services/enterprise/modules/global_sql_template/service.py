from modules.global_sql_template.models.responses import GlobalSqlTemplateResponse
from modules.global_sql_template.repository import GlobalSqlTemplateRepository

class GlobalSqlTemplateService:
    def __init__(self):
        self.repo = GlobalSqlTemplateRepository()

    def get_global_sql_templates(self) -> list[GlobalSqlTemplateResponse]:
        templates = self.repo.get_templates({})
        return [GlobalSqlTemplateResponse(**template.dict()) for template in templates]