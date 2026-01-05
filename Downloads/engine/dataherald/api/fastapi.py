import asyncio
import datetime
import io
import json
import logging
import os
import time
from queue import Queue
from typing import List
import re

from bson.objectid import InvalidId, ObjectId
from fastapi import BackgroundTasks, HTTPException
from overrides import override
from sqlalchemy.exc import SQLAlchemyError

from dataherald.api import API
from dataherald.api.types.requests import (
    NLGenerationRequest,
    NLGenerationsSQLGenerationRequest,
    PromptRequest,
    PromptSQLGenerationNLGenerationRequest,
    PromptSQLGenerationRequest,
    SQLGenerationRequest,
    StreamPromptSQLGenerationRequest,
    UpdateMetadataRequest,
    SaveChatMessageRequest,
)
from dataherald.api.types.responses import (
    DatabaseConnectionResponse,
    GoldenSQLResponse,
    InstructionResponse,
    NLGenerationResponse,
    PromptResponse,
    SQLGenerationResponse,
    TableDescriptionResponse,
    ChatHistoryResponse,
    ChatSummaryResponse,
    SaveChatMessageResponse,
)
from dataherald.config import System
from dataherald.context_store import ContextStore
from dataherald.db import DB
from dataherald.db_scanner import Scanner
from dataherald.db_scanner.models.types import (
    QueryHistory,
)
from dataherald.db_scanner.repository.base import (
    InvalidColumnNameError,
    TableDescriptionRepository,
)
from dataherald.db_scanner.repository.query_history import QueryHistoryRepository
from dataherald.finetuning.openai_finetuning import OpenAIFineTuning
from dataherald.repositories.database_connections import (
    DatabaseConnectionNotFoundError,
    DatabaseConnectionRepository,
)
from dataherald.repositories.finetunings import FinetuningsRepository
from dataherald.repositories.golden_sqls import (
    GoldenSQLNotFoundError,
    GoldenSQLRepository,
)
from dataherald.repositories.instructions import InstructionRepository
from dataherald.repositories.nl_generations import NLGenerationNotFoundError
from dataherald.repositories.prompts import PromptNotFoundError
from dataherald.repositories.sql_generations import SQLGenerationNotFoundError
from dataherald.repositories.global_sql_templates import GlobalSqlTemplateNotFoundError
from dataherald.services.nl_generations import NLGenerationService
from dataherald.services.prompts import PromptService
from dataherald.services.sql_generations import (
    EmptySQLGenerationError,
    SQLGenerationService,
)
from dataherald.services.global_sql_templates import (
    EmptyGlobalSqlTemplateError, 
    GlobalSqlTemplateService
)
from dataherald.services.chat_history import ChatHistoryService
from dataherald.sql_database.base import (
    SQLDatabase,
    SQLInjectionError,
)
from dataherald.sql_database.models.types import DatabaseConnection
from dataherald.sql_database.services.database_connection import (
    DatabaseConnectionService,
)
from dataherald.types import (
    BaseLLM,
    CancelFineTuningRequest,
    DatabaseConnectionRequest,
    Finetuning,
    FineTuningRequest,
    FineTuningStatus,
    GoldenSQL,
    GoldenSQLRequest,
    Instruction,
    InstructionRequest,
    RefreshTableDescriptionRequest,
    ScannerRequest,
    TableDescriptionRequest,
    UpdateInstruction,
)
from dataherald.utils.encrypt import FernetEncrypt
from dataherald.utils.error_codes import error_response, stream_error_response
from dataherald.utils.sql_utils import (
    filter_golden_records_based_on_schema,
    validate_finetuning_schema,
)

logger = logging.getLogger(__name__)

MAX_ROWS_TO_CREATE_CSV_FILE = 50


def async_scanning(scanner, database, table_descriptions, storage):
    scanner.scan(
        database,
        table_descriptions,
        TableDescriptionRepository(storage),
        QueryHistoryRepository(storage),
    )


def async_fine_tuning(system, storage, model):
    openai_fine_tuning = OpenAIFineTuning(system, storage, model)
    openai_fine_tuning.create_fintuning_dataset()
    openai_fine_tuning.create_fine_tuning_job()


def delete_file(file_location: str):
    os.remove(file_location)


class FastAPI(API):
    def __init__(self, system: System):
        super().__init__(system)
        self.system = system
        self.storage = self.system.instance(DB)

    @override
    def heartbeat(self) -> int:
        """Returns the current server time in nanoseconds to check if the server is alive"""
        return int(time.time_ns())

    @override
    def scan_db(
        self, scanner_request: ScannerRequest, background_tasks: BackgroundTasks
    ) -> list[TableDescriptionResponse]:
        """Takes a db_connection_id and scan all the tables columns"""
        scanner_repository = TableDescriptionRepository(self.storage)
        data = {}
        for id in scanner_request.ids:
            table_description = scanner_repository.find_by_id(id)
            if not table_description:
                raise Exception("Table description not found")
            if table_description.db_connection_id not in data.keys():
                data[table_description.db_connection_id] = {}
            if (
                table_description.schema_name
                not in data[table_description.db_connection_id].keys()
            ):
                data[table_description.db_connection_id][
                    table_description.schema_name
                ] = []
            data[table_description.db_connection_id][
                table_description.schema_name
            ].append(table_description)
            print("I AM HERE")

        db_connection_repository = DatabaseConnectionRepository(self.storage)
        print("DB CONNECTION REPO ==========>", db_connection_repository)
        scanner = self.system.instance(Scanner)
        rows = scanner.synchronizing(
            scanner_request,
            TableDescriptionRepository(self.storage),
        )
        database_connection_service = DatabaseConnectionService(scanner, self.storage)
        for db_connection_id, schemas_and_table_descriptions in data.items():
            for schema, table_descriptions in schemas_and_table_descriptions.items():
                db_connection = db_connection_repository.find_by_id(db_connection_id)
                database = database_connection_service.get_sql_database(
                    db_connection, schema
                )

                background_tasks.add_task(
                    async_scanning, scanner, database, table_descriptions, self.storage
                )
        return [TableDescriptionResponse(**row.dict()) for row in rows]

    @override
    def create_database_connection(
        self, database_connection_request: DatabaseConnectionRequest
    ) -> DatabaseConnectionResponse:
        try:
            scanner = self.system.instance(Scanner)
            db_connection_service = DatabaseConnectionService(scanner, self.storage)
            db_connection = db_connection_service.create(database_connection_request)
        except Exception as e:
            # Encrypt sensible values
            fernet_encrypt = FernetEncrypt()
            database_connection_request.connection_uri = fernet_encrypt.encrypt(
                database_connection_request.connection_uri
            )
            ssh_settings = database_connection_request.ssh_settings
            if database_connection_request.ssh_settings:
                ssh_settings.password = fernet_encrypt.encrypt(ssh_settings.password)
                ssh_settings.private_key_password = fernet_encrypt.encrypt(
                    ssh_settings.private_key_password
                )
            return error_response(
                e, database_connection_request.dict(), "invalid_database_connection"
            )
        return DatabaseConnectionResponse(**db_connection.dict())

    @override
    def refresh_table_description(
        self, refresh_table_description: RefreshTableDescriptionRequest
    ) -> list[TableDescriptionResponse]:
        db_connection_repository = DatabaseConnectionRepository(self.storage)
        db_connection = db_connection_repository.find_by_id(
            refresh_table_description.db_connection_id
        )
        scanner = self.system.instance(Scanner)
        database_connection_service = DatabaseConnectionService(scanner, self.storage)
        try:
            data = {}
            if db_connection.schemas:
                for schema in db_connection.schemas:
                    sql_database = database_connection_service.get_sql_database(
                        db_connection, schema
                    )
                    if schema not in data.keys():
                        data[schema] = []
                    data[schema] = sql_database.get_tables_and_views()
            else:
                sql_database = database_connection_service.get_sql_database(
                    db_connection
                )
                data[None] = sql_database.get_tables_and_views()

            scanner_repository = TableDescriptionRepository(self.storage)

            return [
                TableDescriptionResponse(**record.dict())
                for record in scanner.refresh_tables(
                    data, str(db_connection.id), scanner_repository
                )
            ]
        except Exception as e:
            return error_response(e, refresh_table_description.dict(), "refresh_failed")

    @override
    def list_database_connections(self) -> list[DatabaseConnectionResponse]:
        db_connection_repository = DatabaseConnectionRepository(self.storage)
        db_connections = db_connection_repository.find_all()
        return [
            DatabaseConnectionResponse(**db_connection.dict())
            for db_connection in db_connections
        ]

    @override
    def update_database_connection(
        self,
        db_connection_id: str,
        database_connection_request: DatabaseConnectionRequest,
    ) -> DatabaseConnectionResponse:
        try:
            db_connection_repository = DatabaseConnectionRepository(self.storage)
            db_connection = db_connection_repository.find_by_id(db_connection_id)
            if not db_connection:
                raise DatabaseConnectionNotFoundError(
                    f"Database connection {db_connection_id} not found"
                )

            db_connection = DatabaseConnection(
                id=db_connection_id,
                alias=database_connection_request.alias,
                connection_uri=database_connection_request.connection_uri.strip(),
                path_to_credentials_file=database_connection_request.path_to_credentials_file,
                llm_api_key=database_connection_request.llm_api_key,
                use_ssh=database_connection_request.use_ssh,
                ssh_settings=database_connection_request.ssh_settings,
                file_storage=database_connection_request.file_storage,
                metadata=database_connection_request.metadata,
            )

            sql_database = SQLDatabase.get_sql_engine(db_connection, True)

            # Get tables and views and create missing table-descriptions as NOT_SCANNED and update DEPRECATED
            scanner_repository = TableDescriptionRepository(self.storage)
            scanner = self.system.instance(Scanner)

            tables = sql_database.get_tables_and_views()
            db_connection = db_connection_repository.update(db_connection)
            scanner.refresh_tables(tables, str(db_connection.id), scanner_repository)
        except Exception as e:
            # Encrypt sensible values
            fernet_encrypt = FernetEncrypt()
            database_connection_request.connection_uri = fernet_encrypt.encrypt(
                database_connection_request.connection_uri
            )
            ssh_settings = database_connection_request.ssh_settings
            if ssh_settings:
                ssh_settings.password = fernet_encrypt.encrypt(ssh_settings.password)
                ssh_settings.private_key_password = fernet_encrypt.encrypt(
                    ssh_settings.private_key_password
                )
            return error_response(
                e, database_connection_request.dict(), "invalid_database_connection"
            )

        return DatabaseConnectionResponse(**db_connection.dict())

    @override
    def update_table_description(
        self,
        table_description_id: str,
        table_description_request: TableDescriptionRequest,
    ) -> TableDescriptionResponse:
        scanner_repository = TableDescriptionRepository(self.storage)
        try:
            table = scanner_repository.find_by_id(table_description_id)
        except InvalidId as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        if not table:
            raise HTTPException(
                status_code=404, detail="Scanned database table not found"
            )

        try:
            table_description = scanner_repository.update_fields(
                table, table_description_request
            )
            return TableDescriptionResponse(**table_description.dict())
        except InvalidColumnNameError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    @override
    def list_table_descriptions(
        self, db_connection_id: str, table_name: str | None = None
    ) -> list[TableDescriptionResponse]:
        scanner_repository = TableDescriptionRepository(self.storage)
        table_descriptions = scanner_repository.find_by(
            {"db_connection_id": str(db_connection_id), "table_name": table_name}
        )

        return [
            TableDescriptionResponse(**table_description.dict())
            for table_description in table_descriptions
        ]

    @override
    def get_table_description(
        self, table_description_id: str
    ) -> TableDescriptionResponse:
        scanner_repository = TableDescriptionRepository(self.storage)

        try:
            result = scanner_repository.find_by_id(table_description_id)
        except InvalidId as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        if not result:
            raise HTTPException(status_code=404, detail="Table description not found")
        return TableDescriptionResponse(**result.dict())

    @override
    def create_prompt(self, prompt_request: PromptRequest) -> PromptResponse:
        prompt_service = PromptService(self.storage)
        try:
            prompt = prompt_service.create(prompt_request)
        except InvalidId as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except DatabaseConnectionNotFoundError:
            raise HTTPException(  # noqa: B904
                status_code=404, detail="Database connection not found"
            )
        return PromptResponse(**prompt.dict())

    @override
    def get_prompt(self, prompt_id) -> PromptResponse:
        prompt_service = PromptService(self.storage)
        try:
            prompts = prompt_service.get({"_id": ObjectId(prompt_id)})
        except InvalidId as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        if len(prompts) == 0:
            raise HTTPException(  # noqa: B904
                status_code=404, detail=f"Prompt {prompt_id} not found"
            )
        return PromptResponse(**prompts[0].dict())

    @override
    def update_prompt(
        self, prompt_id: str, update_metadata_request: UpdateMetadataRequest
    ) -> PromptResponse:
        prompt_service = PromptService(self.storage)
        try:
            prompt = prompt_service.update_metadata(prompt_id, update_metadata_request)
        except PromptNotFoundError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return PromptResponse(**prompt.dict())

    @override
    def get_prompts(self, db_connection_id: str | None = None) -> List[PromptResponse]:
        prompt_service = PromptService(self.storage)
        query = {}
        if db_connection_id:
            query["db_connection_id"] = db_connection_id
        prompts = prompt_service.get(query)
        result = []
        for prompt in prompts:
            result.append(PromptResponse(**prompt.dict()))
        return result

    @override
    def get_query_history(self, db_connection_id: str) -> list[QueryHistory]:
        query_history_repository = QueryHistoryRepository(self.storage)
        return query_history_repository.find_by(
            {"db_connection_id": str(db_connection_id)}
        )

    @override
    def add_golden_sqls(
        self, golden_sqls: List[GoldenSQLRequest]
    ) -> List[GoldenSQLResponse]:
        """Takes in a list of NL <> SQL pairs and stores them to be used in prompts to the LLM"""
        context_store = self.system.instance(ContextStore)
        try:
            golden_sqls = context_store.add_golden_sqls(golden_sqls)
        except Exception as e:
            return error_response(
                e,
                {"items": [row.dict() for row in golden_sqls]},
                "golden_sql_not_created",
            )
        return [GoldenSQLResponse(**golden_sql.dict()) for golden_sql in golden_sqls]

    @override
    def execute_sql_query(self, sql_generation_id: str, max_rows: int = 100) -> list:
        """Executes a SQL query against the database and returns the results"""
        sql_generation_service = SQLGenerationService(self.system, self.storage)
        try:
            results = sql_generation_service.execute(sql_generation_id, max_rows)
        except SQLGenerationNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except SQLInjectionError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except SQLAlchemyError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return results[1].get("result", [])

    @override
    def execute_invoice_query(self, supplier_name: str, start_date:str, end_date: str, max_rows: int = 100) -> list:
        """Executes a default SQL query for Invoices against the database and returns the results"""
        sql_generation_service = SQLGenerationService(self.system, self.storage)
        try:
            results = sql_generation_service.execute_invoice_query(supplier_name, start_date, end_date, max_rows)
        except SQLGenerationNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except SQLInjectionError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except SQLAlchemyError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return results[1].get("result", [])

    @override
    def export_csv_file(self, sql_generation_id: str) -> io.StringIO:
        """Exports a SQL query to a CSV file"""
        sql_generation_service = SQLGenerationService(self.system, self.storage)
        try:
            csv_dataframe = sql_generation_service.create_dataframe(sql_generation_id)
            csv_stream = io.StringIO()
            csv_dataframe.to_csv(csv_stream, index=False)
        except SQLGenerationNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except SQLInjectionError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except SQLAlchemyError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except EmptySQLGenerationError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return csv_stream

    @override
    def delete_golden_sql(self, golden_sql_id: str) -> dict:
        context_store = self.system.instance(ContextStore)
        status = context_store.remove_golden_sqls([golden_sql_id])
        return {"status": status}

    @override
    def get_golden_sqls(
        self, db_connection_id: str = None, page: int = 1, limit: int = 10
    ) -> List[GoldenSQL]:
        golden_sqls_repository = GoldenSQLRepository(self.storage)
        if db_connection_id:
            return golden_sqls_repository.find_by(
                {"db_connection_id": str(db_connection_id)},
                page=page,
                limit=limit,
            )
        return golden_sqls_repository.find_all(page=page, limit=limit)

    @override
    def update_golden_sql(
        self, golden_sql_id: str, update_metadata_request: UpdateMetadataRequest
    ) -> GoldenSQL:
        golden_sqls_repository = GoldenSQLRepository(self.storage)
        golden_sql = golden_sqls_repository.find_by_id(golden_sql_id)
        if not golden_sql:
            raise HTTPException(status_code=404, detail="Golden record not found")
        golden_sql.metadata = update_metadata_request.metadata
        golden_sqls_repository.update(golden_sql)
        return golden_sql

    @override
    def add_instruction(
        self, instruction_request: InstructionRequest
    ) -> InstructionResponse:
        try:
            db_connection_repository = DatabaseConnectionRepository(self.storage)
            db_connection = db_connection_repository.find_by_id(
                instruction_request.db_connection_id
            )
            if not db_connection:
                raise DatabaseConnectionNotFoundError(
                    f"Database connection {instruction_request.db_connection_id} not found"
                )
            instruction_repository = InstructionRepository(self.storage)
            instruction = Instruction(
                instruction=instruction_request.instruction,
                db_connection_id=instruction_request.db_connection_id,
                metadata=instruction_request.metadata,
            )
            instruction = instruction_repository.insert(instruction)
        except Exception as e:
            return error_response(
                e, instruction_request.dict(), "instruction_not_created"
            )

        return InstructionResponse(**instruction.dict())

    @override
    def get_instructions(
        self, db_connection_id: str = None, page: int = 1, limit: int = 10
    ) -> List[InstructionResponse]:
        instruction_repository = InstructionRepository(self.storage)
        if db_connection_id:
            instructions = instruction_repository.find_by(
                {"db_connection_id": str(db_connection_id)},
                page=page,
                limit=limit,
            )
        else:
            instructions = instruction_repository.find_all(page=page, limit=limit)
        result = []
        for instruction in instructions:
            result.append(InstructionResponse(**instruction.dict()))
        return result

    @override
    def delete_instruction(self, instruction_id: str) -> dict:
        instruction_repository = InstructionRepository(self.storage)
        deleted = instruction_repository.delete_by_id(instruction_id)
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Instruction not found")
        return {"status": "success"}

    @override
    def update_instruction(
        self,
        instruction_id: str,
        instruction_request: UpdateInstruction,
    ) -> InstructionResponse:
        instruction_repository = InstructionRepository(self.storage)
        instruction = instruction_repository.find_by_id(instruction_id)
        if not instruction:
            raise HTTPException(status_code=404, detail="Instruction not found")
        updated_instruction = Instruction(
            id=instruction_id,
            instruction=instruction_request.instruction,
            db_connection_id=instruction.db_connection_id,
            metadata=instruction_request.metadata,
        )
        instruction_repository.update(updated_instruction)
        return InstructionResponse(**updated_instruction.dict())

    @override
    def create_finetuning_job(
        self, fine_tuning_request: FineTuningRequest, background_tasks: BackgroundTasks
    ) -> Finetuning:
        try:
            db_connection_repository = DatabaseConnectionRepository(self.storage)
            db_connection = db_connection_repository.find_by_id(
                fine_tuning_request.db_connection_id
            )
            if not db_connection:
                raise DatabaseConnectionNotFoundError(
                    f"Database connection not found, {fine_tuning_request.db_connection_id}"
                )
            validate_finetuning_schema(fine_tuning_request, db_connection)
            golden_sqls_repository = GoldenSQLRepository(self.storage)
            golden_sqls = []
            if fine_tuning_request.golden_sqls:
                for golden_sql_id in fine_tuning_request.golden_sqls:
                    golden_sql = golden_sqls_repository.find_by_id(golden_sql_id)
                    if not golden_sql:
                        raise GoldenSQLNotFoundError(
                            f"Golden sql not found, {golden_sql_id}"
                        )
                    golden_sqls.append(golden_sql)
            else:
                golden_sqls = golden_sqls_repository.find_by(
                    {"db_connection_id": str(fine_tuning_request.db_connection_id)},
                    page=0,
                    limit=0,
                )
                if not golden_sqls:
                    raise GoldenSQLNotFoundError(
                        f"No golden sqls found for db_connection: {fine_tuning_request.db_connection_id}"
                    )
            golden_sqls = filter_golden_records_based_on_schema(
                golden_sqls, fine_tuning_request.schemas
            )
            default_base_llm = BaseLLM(
                model_provider="openai",
                model_name="gpt-3.5-turbo-1106",
            )
            base_llm = (
                fine_tuning_request.base_llm
                if fine_tuning_request.base_llm
                else default_base_llm
            )
            model_repository = FinetuningsRepository(self.storage)
            model = model_repository.insert(
                Finetuning(
                    db_connection_id=fine_tuning_request.db_connection_id,
                    schemas=fine_tuning_request.schemas,
                    alias=(
                        fine_tuning_request.alias
                        if fine_tuning_request.alias
                        else f"{db_connection.alias}_{datetime.datetime.now().strftime('%Y%m%d%H')}"
                    ),
                    base_llm=base_llm,
                    golden_sqls=[str(golden_sql.id) for golden_sql in golden_sqls],
                    metadata=fine_tuning_request.metadata,
                )
            )
        except Exception as e:
            return error_response(
                e, fine_tuning_request.dict(), "finetuning_not_created"
            )

        background_tasks.add_task(async_fine_tuning, self.system, self.storage, model)

        return model

    @override
    def cancel_finetuning_job(
        self, cancel_fine_tuning_request: CancelFineTuningRequest
    ) -> Finetuning:
        model_repository = FinetuningsRepository(self.storage)
        model = model_repository.find_by_id(cancel_fine_tuning_request.finetuning_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")

        if model.status == FineTuningStatus.SUCCEEDED.value:
            raise HTTPException(
                status_code=400, detail="Model has already succeeded. Cannot cancel."
            )
        if model.status == FineTuningStatus.FAILED.value:
            raise HTTPException(
                status_code=400, detail="Model has already failed. Cannot cancel."
            )
        if model.status == FineTuningStatus.CANCELLED.value:
            raise HTTPException(
                status_code=400, detail="Model has already been cancelled."
            )

        openai_fine_tuning = OpenAIFineTuning(self.system, self.storage, model)

        return openai_fine_tuning.cancel_finetuning_job()

    @override
    def get_finetunings(self, db_connection_id: str | None = None) -> list[Finetuning]:
        model_repository = FinetuningsRepository(self.storage)
        query = {}
        if db_connection_id:
            query["db_connection_id"] = db_connection_id
        models = model_repository.find_by(query)
        result = []
        for model in models:
            openai_fine_tuning = OpenAIFineTuning(self.system, self.storage, model)
            result.append(
                Finetuning(**openai_fine_tuning.retrieve_finetuning_job().dict())
            )
        return result

    @override
    def delete_finetuning_job(self, finetuning_job_id: str) -> dict:
        model_repository = FinetuningsRepository(self.storage)
        deleted = model_repository.delete_by_id(finetuning_job_id)
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Model not found")
        return {"status": "success"}

    @override
    def get_finetuning_job(self, finetuning_job_id: str) -> Finetuning:
        model_repository = FinetuningsRepository(self.storage)
        model = model_repository.find_by_id(finetuning_job_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        openai_fine_tuning = OpenAIFineTuning(self.system, self.storage, model)
        return openai_fine_tuning.retrieve_finetuning_job()

    @override
    def update_finetuning_job(
        self, finetuning_job_id: str, update_metadata_request: UpdateMetadataRequest
    ) -> Finetuning:
        model_repository = FinetuningsRepository(self.storage)
        model = model_repository.find_by_id(finetuning_job_id)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        model.metadata = update_metadata_request.metadata
        return model_repository.update(model)

    @override
    def create_sql_generation(
        self, prompt_id: str, sql_generation_request: SQLGenerationRequest
    ) -> SQLGenerationResponse:
        try:
            ObjectId(prompt_id)
            sql_generation_service = SQLGenerationService(self.system, self.storage)
            sql_generation = sql_generation_service.create(
                prompt_id, sql_generation_request
            )
        except Exception as e:
            return error_response(
                e, sql_generation_request.dict(), "sql_generation_not_created"
            )

        return SQLGenerationResponse(**sql_generation.dict())

    @override
    def create_prompt_and_sql_generation(
        self, prompt_sql_generation_request: PromptSQLGenerationRequest
    ) -> SQLGenerationResponse:
        try:
            # If user did not explicitly mention a date range, instruct the LLM/agent to
            # restrict results to the last 3 months by default.
            prompt_obj = prompt_sql_generation_request.prompt
            text = prompt_obj.text if hasattr(prompt_obj, "text") and prompt_obj.text else ""
            # look for common date-range indicators or explicit date mentions
            date_indicators = [
                r"\blast\b", r"\bmonth(s)?\b", r"\bmonths\b", r"\bfrom\b", r"\bto\b",
                r"\bbetween\b", r"\bstart date\b", r"\bend date\b", r"\b\d{4}-\d{2}-\d{2}\b",
                r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", r"\bInvoiceDate\b", r"\binvoice_date\b",
                r"\bcreated_at\b", r"\bdate\b", r"\bafter\b", r"\bbefore\b"
            ]
            has_date_range = any(re.search(pat, text, flags=re.IGNORECASE) for pat in date_indicators)

            if not has_date_range:
                # Append concise default instruction. Keep it natural-language so the LLM/agent
                # will incorporate a WHERE clause restricting results to the last 3 months.
                default_instruction = (
                    "\n\n[DEFAULT TIME RANGE]: If no date range is specified by the user, restrict "
                    "the query to only return rows from the last 3 months. Prefer reasonable date "
                    "columns such as InvoiceDate, invoice_date, created_at or date when adding the "
                    "WHERE clause. If the user specifies dates explicitly, do not apply this filter."
                )
                # Avoid duplicating instruction if already present
                if default_instruction.strip() not in text:
                    prompt_obj.text = text + default_instruction
                    prompt_sql_generation_request.prompt = prompt_obj

            prompt_service = PromptService(self.storage)
            prompt = prompt_service.create(prompt_sql_generation_request.prompt)
            sql_generation_service = SQLGenerationService(self.system, self.storage)
            sql_generation = sql_generation_service.create(
                prompt.id, prompt_sql_generation_request
            )
        except Exception as e:
            return error_response(
                e, prompt_sql_generation_request.dict(), "sql_generation_not_created"
            )
        return SQLGenerationResponse(**sql_generation.dict())

    @override
    def create_prompt_sql_and_execute_followup_query(
        self,
        prompt_sql_generation_request: PromptSQLGenerationRequest,
        sql_generation_id: str,
    ) -> dict:
        """
        Accepts a new question and an existing sql_generation_id.
        1. Creates a new prompt from the question (reusing create_prompt_and_sql_generation logic).
        2. Fetches the old SQL generation (old SQL).
        
        3. Passes both old and new context to the LLM to generate a follow-up SQL.
        4. Stores and returns the new SQL generation.
        """
        try:            
            # If user did not explicitly mention a date range, instruct the LLM/agent to
            # restrict results to the last 3 months by default.
            prompt_obj = prompt_sql_generation_request.prompt
            text = prompt_obj.text if hasattr(prompt_obj, "text") and prompt_obj.text else ""
            # look for common date-range indicators or explicit date mentions
            date_indicators = [
                r"\blast\b", r"\bmonth(s)?\b", r"\bmonths\b", r"\bfrom\b", r"\bto\b",
                r"\bbetween\b", r"\bstart date\b", r"\bend date\b", r"\b\d{4}-\d{2}-\d{2}\b",
                r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", r"\bInvoiceDate\b", r"\binvoice_date\b",
                r"\bcreated_at\b", r"\bdate\b", r"\bafter\b", r"\bbefore\b"
            ]
            has_date_range = any(re.search(pat, text, flags=re.IGNORECASE) for pat in date_indicators)

            if not has_date_range:
                # Append concise default instruction. Keep it natural-language so the LLM/agent
                # will incorporate a WHERE clause restricting results to the last 3 months.
                default_instruction = (
                    "\n\n[DEFAULT TIME RANGE]: If no date range is specified by the user, restrict "
                    "the query to only return rows from the last 3 months. Prefer reasonable date "
                    "columns such as InvoiceDate, invoice_date, created_at or date when adding the "
                    "WHERE clause. If the user specifies dates explicitly, do not apply this filter."
                )
                # Avoid duplicating instruction if already present
                if default_instruction.strip() not in text:
                    prompt_obj.text = text + default_instruction
                    prompt_sql_generation_request.prompt = prompt_obj

            # Step 1: Create new prompt
            prompt_service = PromptService(self.storage)
            prompt = prompt_service.create(prompt_sql_generation_request.prompt)

            # Step 2: Fetch old SQL generation
            sql_generation_service = SQLGenerationService(self.system, self.storage)
            try:
                old_sql_generation = sql_generation_service.get(
                    {"_id": ObjectId(sql_generation_id)}
                )
            except InvalidId as e:
                raise HTTPException(status_code=400, detail=str(e)) from e

            if len(old_sql_generation) == 0:
                raise HTTPException(
                    status_code=404, 
                    detail=f"SQL Generation with id {sql_generation_id} not found"
                )

            print("STEP 2 DONE")
            # Get the DB details
            db_conn_repo = DatabaseConnectionRepository(self.storage)
            db_connection = db_conn_repo.find_by_id(prompt.db_connection_id)            
            database = SQLDatabase.get_sql_engine(db_connection)
            print("STEP 3 DONE")
            # agent = DataheraldSQLAgent(self.system, None)
            
            # # Run followup queries
            # followup_results = agent.create_followup_sql_agent(prompt.text, old_sql_generation.sql, database)
            # print("Followup Results:", followup_results)

            # Step 5: Prepare context for LLM
            # followup_metadata = sql_generation_metadata or {}

            # Step 6: Generate new SQL using the new prompt
            sql_generation_request = SQLGenerationRequest(
                prompt_id=prompt.id,
                metadata={},
            )
            print("STEP 4 DONE")
            sql_generation = sql_generation_service.create_followup_sql_generation(prompt, db_connection, database, sql_generation_request)
            print("STEP 5 DONE")
            executed_sql_results = database.run_sql(sql_generation.sql, 100)  # test run to validate SQL
            # print("-----------------------------")
            # print("Generated Followup SQL:", sql_generation.sql)
            # print("Executed Followup SQL Results:", executed_sql_results)
            # print("-----------------------------")
            final_result = {
                "sql": sql_generation.sql,
                "sql_results": executed_sql_results[1].get("result", [])
            }
            print("STEP 6 DONE")
            return final_result
        except Exception as e:
            return error_response(
                e,
                {"question": prompt_sql_generation_request.prompt, "sql_generation_id": sql_generation_id},
                "followup_sql_generation_failed",
            )

    @override
    def get_sql_generations(
        self, prompt_id: str | None = None
    ) -> list[SQLGenerationResponse]:
        sql_generation_service = SQLGenerationService(self.system, self.storage)
        query = {}
        if prompt_id:
            query["prompt_id"] = prompt_id
        sql_generations = sql_generation_service.get(query)
        result = []
        for sql_generation in sql_generations:
            result.append(SQLGenerationResponse(**sql_generation.dict()))
        return result

    @override
    def get_sql_generation(self, sql_generation_id: str) -> SQLGenerationResponse:
        sql_generation_service = SQLGenerationService(self.system, self.storage)
        try:
            sql_generations = sql_generation_service.get(
                {"_id": ObjectId(sql_generation_id)}
            )
        except InvalidId as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        if len(sql_generations) == 0:
            raise HTTPException(
                status_code=404, detail=f"SQL Generation {sql_generation_id} not found"
            )
        return SQLGenerationResponse(**sql_generations[0].dict())

    @override
    def update_sql_generation(
        self, sql_generation_id: str, update_metadata_request: UpdateMetadataRequest
    ) -> SQLGenerationResponse:
        sql_generation_service = SQLGenerationService(self.system, self.storage)
        try:
            sql_generation = sql_generation_service.update_metadata(
                sql_generation_id, update_metadata_request
            )
        except SQLGenerationNotFoundError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return SQLGenerationResponse(**sql_generation.dict())

    @override
    def create_nl_generation(
        self, sql_generation_id: str, nl_generation_request: NLGenerationRequest
    ) -> NLGenerationResponse:
        try:
            ObjectId(sql_generation_id)
            nl_generation_service = NLGenerationService(self.system, self.storage)
            nl_generation = nl_generation_service.create(
                sql_generation_id, nl_generation_request
            )
        except Exception as e:
            return error_response(
                e,
                {
                    "sql_generation_id": sql_generation_id,
                    "request": nl_generation_request.dict(),
                },
                "nl_generation_not_created",
            )

        return NLGenerationResponse(**nl_generation.dict())

    @override
    def create_sql_and_nl_generation(
        self,
        prompt_id: str,
        nl_generation_sql_generation_request: NLGenerationsSQLGenerationRequest,
    ) -> NLGenerationResponse:
        try:
            ObjectId(prompt_id)
            sql_generation_service = SQLGenerationService(self.system, self.storage)
            sql_generation = sql_generation_service.create(
                prompt_id, nl_generation_sql_generation_request.sql_generation
            )
            nl_generation_service = NLGenerationService(self.system, self.storage)
            nl_generation = nl_generation_service.create(
                sql_generation.id, nl_generation_sql_generation_request
            )
        except Exception as e:
            return error_response(
                e,
                {
                    "prompt_id": prompt_id,
                    "request": nl_generation_sql_generation_request.dict(),
                },
                "nl_generation_not_created",
            )

        return NLGenerationResponse(**nl_generation.dict())

    @override
    def create_prompt_sql_and_nl_generation(
        self, request: PromptSQLGenerationNLGenerationRequest
    ) -> NLGenerationResponse:
        prompt_service = PromptService(self.storage)
        try:
            prompt = prompt_service.create(request.sql_generation.prompt)
            sql_generation_service = SQLGenerationService(self.system, self.storage)
            sql_generation = sql_generation_service.create(
                prompt.id, request.sql_generation
            )
            nl_generation_service = NLGenerationService(self.system, self.storage)
            nl_generation = nl_generation_service.create(sql_generation.id, request)
        except Exception as e:
            return error_response(e, request.dict(), "nl_generation_not_created")

        return NLGenerationResponse(**nl_generation.dict())

    @override
    def get_nl_generations(
        self, sql_generation_id: str | None = None
    ) -> list[NLGenerationResponse]:
        nl_generation_service = NLGenerationService(self.system, self.storage)
        query = {}
        if sql_generation_id:
            query["sql_generation_id"] = sql_generation_id
        nl_generations = nl_generation_service.get(query)
        result = []
        for nl_generation in nl_generations:
            result.append(NLGenerationResponse(**nl_generation.dict()))
        return result

    @override
    def update_nl_generation(
        self, nl_generation_id: str, update_metadata_request: UpdateMetadataRequest
    ) -> NLGenerationResponse:
        nl_generation_service = NLGenerationService(self.system, self.storage)
        try:
            nl_generation = nl_generation_service.update_metadata(
                nl_generation_id, update_metadata_request
            )
        except NLGenerationNotFoundError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return NLGenerationResponse(**nl_generation.dict())

    @override
    def get_nl_generation(self, nl_generation_id: str) -> NLGenerationResponse:
        nl_generation_service = NLGenerationService(self.system, self.storage)
        try:
            nl_generations = nl_generation_service.get(
                {"_id": ObjectId(nl_generation_id)}
            )
        except InvalidId as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        if len(nl_generations) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"NL Generation {nl_generation_id} not found",
            )
        return NLGenerationResponse(**nl_generations[0].dict())

    @override
    async def stream_create_prompt_and_sql_generation(
        self,
        request: StreamPromptSQLGenerationRequest,
    ):
        try:
            queue = Queue()
            prompt_service = PromptService(self.storage)
            prompt = prompt_service.create(request.prompt)
            sql_generation_service = SQLGenerationService(self.system, self.storage)
            sql_generation_service.start_streaming(prompt.id, request, queue)
            while True:
                value = queue.get()
                if value is None:
                    break
                yield value
                queue.task_done()
                await asyncio.sleep(0.001)
        except Exception as e:
            yield json.dumps(
                stream_error_response(e, request.dict(), "nl_generation_not_created")
            )


    @override
    def store_chat_message(self, save_chat_message_request: SaveChatMessageRequest) -> SaveChatMessageResponse:
        """Saves Chat message to the database"""
        chat_history_service = ChatHistoryService(self.storage)
        try:
            chat = chat_history_service.save_message(
                user_id=save_chat_message_request.user_id,
                role=save_chat_message_request.role,
                content=save_chat_message_request.content,
                chat_id=save_chat_message_request.chat_id,
                title=save_chat_message_request.title,
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        # Return SaveChatMessageResponse (Pydantic will validate/serialize)
        return SaveChatMessageResponse(**chat.dict())

    @override
    def get_chat_history(self, user_id: str) -> list[ChatSummaryResponse]:
        """Gets Chat list (no messages) for the user"""
        chat_history_service = ChatHistoryService(self.storage)
        chats = chat_history_service.get_user_chats(user_id)
        # Return summary (id, title, created_at, updated_at) without messages
        return [
            ChatSummaryResponse(
                id=chat.id,
                title=chat.title,
                created_at=chat.created_at,
                updated_at=chat.updated_at,
            )
            for chat in chats
        ]

    @override
    def get_chat_by_id(self, chat_id: str, user_id: str) -> ChatHistoryResponse:
        """Gets Chat message by Id from the database"""
        chat_history_service = ChatHistoryService(self.storage)
        chat = chat_history_service.get_chat_by_id(chat_id, user_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return ChatHistoryResponse(**chat.dict())

    @override
    def update_chat_title(self, chat_id: str, user_id: str, title: str) -> dict:
        """Updates Chat title by Id from the database"""
        chat_history_service = ChatHistoryService(self.storage)
        chat = chat_history_service.update_chat_title(chat_id, user_id, title)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat title not found")
        return {"success": True, "message": "Chat title updated successfully", "title": chat.title}

    @override
    def delete_chat_by_id(self, chat_id: str, user_id: str, soft_delete: bool) -> dict:
        """Delete Chat by Id from the database"""
        chat_history_service = ChatHistoryService(self.storage)
        success = chat_history_service.delete_chat_by_id(chat_id, user_id, soft_delete)
        if not success:
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"success": True, "message": "Chat deleted successfully"}
    
    @override
    def execute_global_sql_template(self, global_sql_template_id: str, db_connection_id: str, max_rows: int = 100) -> list:
        """Executes a SQL query against the database and returns the results"""
        global_sql_template_service = GlobalSqlTemplateService(self.system, self.storage)
        try:
            results = global_sql_template_service.execute(global_sql_template_id, db_connection_id, max_rows)
        except GlobalSqlTemplateNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except SQLInjectionError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except SQLAlchemyError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        return results[1].get("result", [])