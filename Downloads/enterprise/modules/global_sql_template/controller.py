from fastapi import APIRouter, Security
from modules.global_sql_template.models.responses import GlobalSqlTemplateResponse
from modules.global_sql_template.service import GlobalSqlTemplateService
from utils.auth import User, authenticate_user

router = APIRouter(
    prefix="/global-sql-templates",
    responses={404: {"description": "Not found"}},
)

template_service = GlobalSqlTemplateService()

@router.get("", response_model=list[GlobalSqlTemplateResponse])
async def get_global_sql_templates(
    session_user: User = Security(authenticate_user),
) -> list[GlobalSqlTemplateResponse]:
    return template_service.get_global_sql_templates()