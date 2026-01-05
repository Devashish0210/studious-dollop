from bson.objectid import ObjectId

from dataherald.types import GlobalSqlTemplate

DB_COLLECTION = "global_sql_template"


class GlobalSqlTemplateNotFoundError(Exception):
    pass


class GlobalSqlTemplateRepository:
    def __init__(self, storage):
        self.storage = storage

    def insert(self, global_sql_template: GlobalSqlTemplate) -> GlobalSqlTemplate:
        global_sql_template_dict = global_sql_template.dict(exclude={"id"})
        global_sql_template.id = str(
            self.storage.insert_one(DB_COLLECTION, global_sql_template_dict)
        )
        return global_sql_template

    def update(self, global_sql_template: GlobalSqlTemplate) -> GlobalSqlTemplate:
        global_sql_template_dict = global_sql_template.dict(exclude={"id"})
        self.storage.update_or_create(
            DB_COLLECTION,
            {"_id": ObjectId(global_sql_template.id)},
            global_sql_template_dict,
        )
        return global_sql_template

    def find_one(self, query: dict) -> GlobalSqlTemplate | None:
        row = self.storage.find_one(DB_COLLECTION, query)
        if not row:
            return None
        row["id"] = str(row["_id"])
        return GlobalSqlTemplate(**row)

    def find_by_id(self, id: str) -> GlobalSqlTemplate | None:
        row = self.storage.find_one(DB_COLLECTION, {"_id": ObjectId(id)})
        if not row:
            return None
        row["id"] = str(row["_id"])
        return GlobalSqlTemplate(**row)

    def find_by(
        self, query: dict, page: int = 0, limit: int = 0
    ) -> list[GlobalSqlTemplate]:
        if page > 0 and limit > 0:
            rows = self.storage.find(DB_COLLECTION, query, page=page, limit=limit)
        else:
            rows = self.storage.find(DB_COLLECTION, query)
        result = []
        for row in rows:
            row["id"] = str(row["_id"])
            result.append(GlobalSqlTemplate(**row))
        return result
