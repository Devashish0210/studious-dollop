from pydantic import BaseModel
from utils.validation import ObjectIdString

class GlobalSqlTemplate(BaseModel):
    id: ObjectIdString | None
    sql: str
    visible_text: str
    description: str | None
    db_connection_id: str