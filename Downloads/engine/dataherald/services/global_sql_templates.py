from dataherald.config import System
from dataherald.types import GlobalSqlTemplate
from dataherald.sql_database.base import SQLDatabase
from dataherald.repositories.database_connections import ( DatabaseConnectionRepository)
from dataherald.repositories.global_sql_templates import ( 
    GlobalSqlTemplateNotFoundError,
    GlobalSqlTemplateRepository
)


class GlobalSqlTemplateError(Exception):
    pass


class EmptyGlobalSqlTemplateError(Exception):
    pass


class GlobalSqlTemplateService:
    def __init__(self, system: System, storage):
        self.system = system
        self.storage = storage
        self.global_sql_template_repository = GlobalSqlTemplateRepository(storage)

    def update_error(self, global_sql_template: GlobalSqlTemplate, error: str) -> GlobalSqlTemplate:
        global_sql_template.error = error
        return self.global_sql_template_repository.update(global_sql_template)

    def get(self, query) -> list[GlobalSqlTemplate]:
        return self.global_sql_template_repository.find_by(query)

    def execute(self, global_sql_template_id: str, db_connection_id: str, max_rows: int = 100) -> tuple[str, dict]:
        global_sql_template = self.global_sql_template_repository.find_by_id(global_sql_template_id)
        if not global_sql_template:
            raise GlobalSqlTemplateNotFoundError(
                f"Global SQL Template {global_sql_template_id} not found"
            )
        db_connection_repository = DatabaseConnectionRepository(self.storage)
        db_connection = db_connection_repository.find_by_id(db_connection_id)
        database = SQLDatabase.get_sql_engine(db_connection, True)
        return database.run_sql(global_sql_template.sql, max_rows)
