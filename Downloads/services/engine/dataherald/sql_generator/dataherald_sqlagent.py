import datetime
import difflib
import logging
import os
from functools import wraps
from queue import Queue
from threading import Thread
from typing import Any, Callable, Dict, List

import numpy as np
import openai
import pandas as pd
from google.api_core.exceptions import GoogleAPIError
from langchain.agents.agent import AgentExecutor
from langchain.agents.agent_toolkits.base import BaseToolkit
from langchain.agents.mrkl.base import ZeroShotAgent
from langchain.callbacks.base import BaseCallbackManager
from langchain.callbacks.manager import (
    AsyncCallbackManagerForToolRun,
    CallbackManagerForToolRun,
)
from langchain.chains.llm import LLMChain
from langchain.tools.base import BaseTool
from langchain_community.callbacks import get_openai_callback
from langchain_openai import AzureOpenAIEmbeddings, OpenAIEmbeddings
from overrides import override
from pydantic import BaseModel, Field
from sql_metadata import Parser
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, Field
from langchain_openai import AzureChatOpenAI 
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dataherald.utils.agent_prompts import TABLE_DESCRIPTION


from dataherald.context_store import ContextStore
from dataherald.db import DB
from dataherald.db_scanner.models.types import TableDescription, TableDescriptionStatus
from dataherald.db_scanner.repository.base import TableDescriptionRepository
from dataherald.repositories.sql_generations import (
    SQLGenerationRepository,
)
from dataherald.sql_database.base import SQLDatabase, SQLInjectionError
from dataherald.sql_database.models.types import (
    DatabaseConnection,
)
from dataherald.sql_generator import EngineTimeOutORItemLimitError, SQLGenerator
from dataherald.types import Prompt, SQLGeneration
from dataherald.utils.agent_prompts import (
    AGENT_PREFIX,
    ERROR_PARSING_MESSAGE,
    FORMAT_INSTRUCTIONS,
    PLAN_BASE,
    PLAN_WITH_FEWSHOT_EXAMPLES,
    PLAN_WITH_FEWSHOT_EXAMPLES_AND_INSTRUCTIONS,
    PLAN_WITH_INSTRUCTIONS,
    SUFFIX_WITH_FEW_SHOT_SAMPLES,
    SUFFIX_WITHOUT_FEW_SHOT_SAMPLES,
)
from dataherald.utils.timeout_utils import run_with_timeout

logger = logging.getLogger(__name__)


TOP_K = SQLGenerator.get_upper_bound_limit()
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL","text-embedding-3-large")
TOP_TABLES = 20


def catch_exceptions():  # noqa: C901
    def decorator(fn: Callable[[str], str]) -> Callable[[str], str]:  # noqa: C901
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:  # noqa: PLR0911
            try:
                return fn(*args, **kwargs)
            except openai.AuthenticationError as e:
                # Handle authentication error here
                return f"OpenAI API authentication error: {e}"
            except openai.RateLimitError as e:
                # Handle API error here, e.g. retry or log
                return f"OpenAI API request exceeded rate limit: {e}"
            except openai.BadRequestError as e:
                # Handle connection error here
                return f"OpenAI API request timed out: {e}"
            except openai.APIResponseValidationError as e:
                # Handle rate limit error (we recommend using exponential backoff)
                return f"OpenAI API response is invalid: {e}"
            except openai.OpenAIError as e:
                # Handle timeout error (we recommend using exponential backoff)
                return f"OpenAI API returned an error: {e}"
            except GoogleAPIError as e:
                return f"Google API returned an error: {e}"
            except SQLAlchemyError as e:
                return f"Error: {e}"
            except Exception as e:
                return f"Error: {e}"

        return wrapper

    return decorator


def replace_unprocessable_characters(text: str) -> str:
    """Replace unprocessable characters with a space."""
    text = text.strip()
    return text.replace(r"\_", "_")


# Classes needed for tools
class BaseSQLDatabaseTool(BaseModel):
    """Base tool for interacting with the SQL database and the context information."""

    db: SQLDatabase = Field(exclude=True)
    context: List[dict] | None = Field(exclude=True, default=None)

    class Config(BaseTool.Config):
        """Configuration for this pydantic object."""

        arbitrary_types_allowed = True
        extra = "allow"


class SystemTime(BaseSQLDatabaseTool, BaseTool):
    """Tool for finding the current data and time."""

    name = "SystemTime"
    description = """
    Input is an empty string, output is the current data and time.
    Always use this tool before generating a query if there is any time or date in the given question.
    """

    @catch_exceptions()
    def _run(
        self,
        tool_input: str = "",  # noqa: ARG002
        run_manager: CallbackManagerForToolRun | None = None,  # noqa: ARG002
    ) -> str:
        """Execute the query, return the results or an error message."""
        current_datetime = datetime.datetime.now()
        return f"Current Date and Time: {str(current_datetime)}"

    async def _arun(
        self,
        tool_input: str = "",
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("GetCurrentTimeTool does not support async")


class QuerySQLDataBaseTool(BaseSQLDatabaseTool, BaseTool):
    """Tool for querying a SQL database."""

    name = "SqlDbQuery"
    description = """
    Input: -- A well-formed multi-line SQL query between ```sql and ``` tags.
    Output: Result from the database or an error message if the query is incorrect.
    If an error occurs, rewrite the query and retry.
    Use this tool to execute SQL queries.
    Add newline after both ```sql and ``` tags.
    """

    @catch_exceptions()
    def _run(
        self,
        query: str,
        top_k: int = TOP_K,
        run_manager: CallbackManagerForToolRun | None = None,  # noqa: ARG002
    ) -> str:
        """Execute the query, return the results or an error message."""
        query = replace_unprocessable_characters(query)
        if "```sql" in query:
            query = query.replace("```sql", "").replace("```", "")

        try:
            return run_with_timeout(
                self.db.run_sql,
                args=(query,),
                kwargs={"top_k": top_k},
                timeout_duration=200,
            )[0]
        except TimeoutError:
            return "SQL query execution time exceeded, proceed without query execution"

    async def _arun(
        self,
        query: str,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("QuerySQLDataBaseTool does not support async")


class GetUserInstructions(BaseSQLDatabaseTool, BaseTool):
    """Tool for retrieving the instructions from the user"""

    name = "GetAdminInstructions"
    description = """
    Input: is an empty string.
    Output: Database admin instructions before generating the SQL query.
    The generated SQL query MUST follow the admin instructions even it contradicts with the given question.
    """
    instructions: List[dict]

    @catch_exceptions()
    def _run(
        self,
        tool_input: str = "",  # noqa: ARG002
        run_manager: CallbackManagerForToolRun | None = None,  # noqa: ARG002
    ) -> str:
        response = "Admin: All of the generated SQL queries must follow the below instructions:\n"
        for index, instruction in enumerate(self.instructions):
            response += f"{index + 1}) {instruction['instruction']}\n"
        return response

    async def _arun(
        self,
        tool_input: str = "",  # noqa: ARG002
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("GetUserInstructions does not support async")


class TablesSQLDatabaseTool(BaseSQLDatabaseTool, BaseTool):
    """Tool which takes in the given question and returns a list of tables with their relevance score to the question"""

    name = "DbTablesWithRelevanceScores"
    description = """
    Input: Given question.
    Output: Comma-separated list of tables with their relevance scores, indicating their relevance to the question.
    Use this tool to identify the relevant tables for the given question.
    """
    db_scan: List[TableDescription]
    embedding: OpenAIEmbeddings
    few_shot_examples: List[dict] | None = Field(exclude=True, default=None)

    def get_embedding(
        self,
        text: str,
    ) -> List[float]:
        text = text.replace("\n", " ")
        return self.embedding.embed_query(text)

    def get_docs_embedding(
        self,
        docs: List[str],
    ) -> List[List[float]]:
        return self.embedding.embed_documents(docs)

    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        return round(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)), 4)

    def similar_tables_based_on_few_shot_examples(self, df: pd.DataFrame) -> List[str]:
        most_similar_tables = set()
        if self.few_shot_examples is not None:
            for example in self.few_shot_examples:
                try:
                    tables = Parser(example["sql"]).tables
                except Exception as e:
                    logger.error(f"Error parsing SQL: {str(e)}")
                for table in tables:
                    found_tables = df[df.table_name == table]
                    for _, row in found_tables.iterrows():
                        most_similar_tables.add((row["schema_name"], row["table_name"]))
            df.drop(
                df[
                    df.table_name.isin([table[1] for table in most_similar_tables])
                ].index,
                inplace=True,
            )
        return most_similar_tables
    
    def _get_context(self, user_question: str):
        """Shared logic to prepare catalog and prompt variables."""
        schema_catalog = []
        for table in self.db_scan:
            cols = ", ".join([c.name for c in table.columns])
            desc = TABLE_DESCRIPTION.get(table.table_name, "No description available")
            schema_catalog.append(
                f"Table: {table.table_name}\nColumns: [{cols}]\nDescription: {desc}"
            )
        catalog_str = "\n\n".join(schema_catalog)
        
        myprompt = ChatPromptTemplate.from_messages([
            ("system", 
             """You are a SQL Expert. Identify which tables are required to answer the question.
                Rules:
                1. Only return tables with a relevance score between 0.3 and 1.0.
                2. If multiple tables are needed (e.g., for JOINS), list each on a new line.
                3. Use the exact format: Table: `table_name`, relevance score: 0.9
                4. Do not provide any introductory text or markdown code blocks.

                Example Output:
                Table: `sundry_debtors`, relevance score: 0.9
                Table: `account_transactions`, relevance score: 0.8"""),
            ("human", "Question: {user_question}\n\nAvailable Tables:\n{catalog_str}"),
        ])
        return myprompt, {"user_question": user_question, "catalog_str": catalog_str}

    def _run(self, user_question: str, **kwargs) -> str:
        """Pure synchronous execution. NO ASYNCIO.RUN."""
        myprompt, inputs = self._get_context(user_question)
        
        # Use a standard LLM call - No await, no ainvoke
        llm = AzureChatOpenAI(
            azure_deployment=os.getenv("LLM_MODEL"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            openai_api_version=os.getenv("AZURE_API_VERSION"),
            openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            temperature=0
        )
        chain = myprompt | llm | StrOutputParser()
        
        # Use .invoke() instead of .ainvoke()
        return chain.invoke(inputs)

class ColumnEntityChecker(BaseSQLDatabaseTool, BaseTool):
    """Tool for checking the existance of an entity inside a column."""

    name = "DbColumnEntityChecker"
    description = """
    Input: Column name and its corresponding table, and an entity.
    Output: cell-values found in the column similar to the given entity.
    Use this tool to get cell values similar to the given entity in the given column.

    Example Input: table1 -> column2, entity
    """
    db_scan: List[TableDescription]
    is_multiple_schema: bool

    def find_similar_strings(
        self, input_list: List[tuple], target_string: str, threshold=0.4
    ):
        similar_strings = []
        for item in input_list:
            similarity = difflib.SequenceMatcher(
                None, str(item[0]).strip().lower(), target_string.lower()
            ).ratio()
            if similarity >= threshold:
                similar_strings.append((str(item[0]).strip(), similarity))
        similar_strings.sort(key=lambda x: x[1], reverse=True)
        return similar_strings[:25]

    @catch_exceptions()
    def _run(
        self,
        tool_input: str,
        run_manager: CallbackManagerForToolRun | None = None,  # noqa: ARG002
    ) -> str:
        try:
            schema, entity = tool_input.split(",")
            table_name, column_name = schema.split("->")
            table_name = replace_unprocessable_characters(table_name)
            column_name = replace_unprocessable_characters(column_name).strip()
            if "." not in table_name and self.is_multiple_schema:
                raise Exception(
                    "Table name should be in the format schema_name.table_name"
                )
        except ValueError:
            return "Invalid input format, use following format: table_name -> column_name, entity (entity should be a string without ',')"
        search_pattern = f"%{entity.strip().lower()}%"
        search_query = f"SELECT DISTINCT {column_name} FROM {table_name} WHERE {column_name} ILIKE :search_pattern"  # noqa: S608
        try:
            search_results = self.db.engine.execute(
                search_query, {"search_pattern": search_pattern}
            ).fetchall()
            search_results = search_results[:25]
        except SQLAlchemyError:
            search_results = []
        distinct_query = (
            f"SELECT DISTINCT {column_name} FROM {table_name}"  # noqa: S608
        )
        results = self.db.engine.execute(distinct_query).fetchall()
        results = self.find_similar_strings(results, entity)
        similar_items = "Similar items:\n"
        already_added = {}
        for item in results:
            similar_items += f"{item[0]}\n"
            already_added[item[0]] = True
        if len(search_results) > 0:
            for item in search_results:
                if item[0] not in already_added:
                    similar_items += f"{item[0]}\n"
        return similar_items

    async def _arun(
        self,
        tool_input: str,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("ColumnEntityChecker does not support async")


class SchemaSQLDatabaseTool(BaseSQLDatabaseTool, BaseTool):
    """Tool for getting schema of relevant tables."""

    name = "DbRelevantTablesSchema"
    description = """
    Input: Comma-separated list of tables.
    Output: Schema of the specified tables.
    Use this tool to discover all columns of the relevant tables and identify potentially relevant columns.

    Example Input: table1, table2, table3
    """
    db_scan: List[TableDescription]

    @catch_exceptions()
    def _run(  # noqa: C901
        self,
        table_names: str,
        run_manager: CallbackManagerForToolRun | None = None,  # noqa: ARG002
    ) -> str:
        """Get the schema for tables in a comma-separated list."""
        table_names_list = table_names.split(", ")
        processed_table_names = []
        for table in table_names_list:
            formatted_table = replace_unprocessable_characters(table)
            if "." in formatted_table:
                processed_table_names.append(formatted_table.split(".")[1])
            else:
                processed_table_names.append(formatted_table)
        tables_schema = "```sql\n"
        for table in self.db_scan:
            if table.table_name in processed_table_names:
                tables_schema += table.table_schema + "\n"
                descriptions = []
                if table.description is not None:
                    if table.schema_name:
                        table_name = f"{table.schema_name}.{table.table_name}"
                    else:
                        table_name = table.table_name
                    descriptions.append(f"Table `{table_name}`: {table.description}\n")
                    for column in table.columns:
                        if column.description is not None:
                            descriptions.append(
                                f"Column `{column.name}`: {column.description}\n"
                            )
                if len(descriptions) > 0:
                    tables_schema += f"/*\n{''.join(descriptions)}*/\n"
        tables_schema += "```\n"
        if tables_schema == "":
            tables_schema += "Tables not found in the database"
        return tables_schema

    async def _arun(
        self,
        table_name: str,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("SchemaSQLDatabaseTool does not support async")


class InfoRelevantColumns(BaseSQLDatabaseTool, BaseTool):
    """Tool for getting more information for potentially relevant columns"""

    name = "DbRelevantColumnsInfo"
    description = """
    Input: Comma-separated list of potentially relevant columns with their corresponding table.
    Output: Information about the values inside the columns and their descriptions.
    Use this tool to gather details about potentially relevant columns. then, filter them, and identify the relevant ones.

    Example Input: table1 -> column1, table1 -> column2, table2 -> column1
    """
    db_scan: List[TableDescription]

    @catch_exceptions()
    def _run(  # noqa: C901, PLR0912
        self,
        column_names: str,
        run_manager: CallbackManagerForToolRun | None = None,  # noqa: ARG002
    ) -> str:
        """Get the column level information."""
        items_list = column_names.split(", ")
        column_full_info = ""
        for item in items_list:
            if " -> " in item:
                table_name, column_name = item.split(" -> ")
                if "." in table_name:
                    table_name = table_name.split(".")[1]
                table_name = replace_unprocessable_characters(table_name)
                column_name = replace_unprocessable_characters(column_name)
                found = False
                for table in self.db_scan:
                    if table_name == table.table_name:
                        col_info = ""
                        for column in table.columns:
                            if column_name == column.name:
                                found = True
                                col_info += f"Description: {column.description},"
                                if column.low_cardinality:
                                    col_info += f" categories = {column.categories},"
                        col_info += " Sample rows: "
                        if found:
                            for row in table.examples:
                                col_info += row[column_name] + ", "
                            col_info = col_info[:-2]
                            if table.schema_name:
                                schema_table = f"{table.schema_name}.{table.table_name}"
                            else:
                                schema_table = table.table_name
                            column_full_info += f"Table: {schema_table}, column: {column_name}, additional info: {col_info}\n"
            else:
                return "Malformed input, input should be in the following format Example Input: table1 -> column1, table1 -> column2, table2 -> column1"  # noqa: E501
            if not found:
                column_full_info += f"Table: {table_name}, column: {column_name} not found in database\n"
        return column_full_info

    async def _arun(
        self,
        table_name: str,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("InfoRelevantColumnsTool does not support async")


class GetFewShotExamples(BaseSQLDatabaseTool, BaseTool):
    """Tool to obtain few-shot examples from the pool of samples"""

    name = "FewshotExamplesRetriever"
    description = """
    Input: Number of required Question/SQL pairs.
    Output: List of similar Question/SQL pairs related to the given question.
    Use this tool to fetch previously asked Question/SQL pairs as examples for improving SQL query generation.
    For complex questions, request more examples to gain a better understanding of tables and columns and the SQL keywords to use.
    If the given question is very similar to one of the retrieved examples, it is recommended to use the same SQL query and modify it slightly to fit the given question.
    Always use this tool first and before any other tool!
    """  # noqa: E501
    few_shot_examples: List[dict]

    @catch_exceptions()
    def _run(
        self,
        number_of_samples: str,
        run_manager: CallbackManagerForToolRun | None = None,  # noqa: ARG002
    ) -> str:
        """Get the schema for tables in a comma-separated list."""
        if number_of_samples.strip().isdigit():
            number_of_samples = int(number_of_samples.strip())
        else:
            return "Action input for the fewshot_examples_retriever tool should be an integer"
        returned_output = ""
        for example in self.few_shot_examples[:number_of_samples]:
            returned_output += f"Question: {example['prompt_text']} \n"
            returned_output += f"```sql\n{example['sql']}\n```\n"
        if returned_output == "":
            returned_output = "No previously asked Question/SQL pairs are available"
        return returned_output

    async def _arun(
        self,
        number_of_samples: str,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("GetFewShotExamplesTool does not support async")

# Tool to get all the columns of the table
class QuerySimpleSQLTool(BaseSQLDatabaseTool, BaseTool):
    """ Tool for getting the columns of the Table. 
        This tool will take SQL as input modify the SQL to "SELECT * FROM <table> LIMIT 10;" and then run the SQL to get all the columns of the table with Data.
        If multiple tables are present in the SQL, it will return the columns of all the tables.
    """

    name = "QuerySimpleSQLTool"
    description = """
    Input: A well-formed multi-line SQL query
    Output: Result from the database or an error message if the query is incorrect or not present.
    """

    def followup_modify_sql(self, sql: str) -> dict:
        """
        Modify the original SQL by:
        - Selecting all columns (*)
        - Removing WHERE, GROUP BY, HAVING, ORDER BY clauses
        - Converting all JOINs to FULL JOIN
        - Enforcing LIMIT 10
        Returns the modified SQL.
        """
        import re

        modified_sql = sql.strip().rstrip(";")

        # 1. Replace SELECT columns with *
        modified_sql = re.sub(
            r"select\s+.*?\s+from",
            "SELECT * FROM",
            modified_sql,
            flags=re.IGNORECASE | re.DOTALL
        )

        # 2. Convert all joins to FULL JOIN
        modified_sql = re.sub(
            r"\b(left|right|inner|outer|cross)?\s*join\b",
            "FULL JOIN",
            modified_sql,
            flags=re.IGNORECASE
        )

        # 3. Remove WHERE clause
        modified_sql = re.sub(
            r"\bwhere\b[\s\S]*?(?=\b(group\s+by|having|order\s+by|limit)\b|$)",
            "",
            modified_sql,
            flags=re.IGNORECASE
        )

        # 4. Remove GROUP BY clause
        modified_sql = re.sub(
            r"\bgroup\s+by\b[\s\S]*?(?=\bhaving\b|\border\s+by\b|\blimit\b|$)",
            "",
            modified_sql,
            flags=re.IGNORECASE
        )

        # 5. Remove HAVING clause
        modified_sql = re.sub(
            r"\bhaving\b[\s\S]*?(?=\border\s+by\b|\blimit\b|$)",
            "",
            modified_sql,
            flags=re.IGNORECASE
        )

        # 6. Remove ORDER BY clause
        modified_sql = re.sub(
            r"\border\s+by\b[\s\S]*?(?=\blimit\b|$)",
            "",
            modified_sql,
            flags=re.IGNORECASE
        )

        # 7. Remove existing LIMIT clause (any form)
        modified_sql = re.sub(
            r"\blimit\b\s+\d+(\s*,\s*\d+)?",
            "",
            modified_sql,
            flags=re.IGNORECASE
        )

        # Clean up whitespace
        modified_sql = re.sub(r"\s+", " ", modified_sql).strip()

        # 8. Enforce LIMIT 10
        modified_sql = f"{modified_sql} LIMIT 10;"

        return {"modified_sql": modified_sql}

    @catch_exceptions()
    def _run(
        self,
        tool_input: dict,
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> str:
        """Execute the follow-up query using inlined run_followup_queries logic."""
        sql = tool_input.get('sql', '')
        if not sql:
            return "Invalid input: 'sql' is required."

        result = {}
        try:
            # Get modified SQL
            modified = self.followup_modify_sql(sql)
            modified_sql = modified["modified_sql"]

            # Execute modified SQL
            res = self.db.run(modified_sql)

            result["modified_sql"] = modified_sql
            result["results"] = res

        except Exception as e:
            result["error"] = str(e)

        if 'error' in result:
            return f"Error: {result['error']}"
        output = f"Modified SQL:\n{result['modified_sql']}\n\nResults:\n{result['results']}"
        return output

    async def _arun(
        self,
        tool_input: dict,
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("FollowupSQLTool does not support async")

class SQLDatabaseToolkit(BaseToolkit):
    """Dataherald toolkit"""

    db: SQLDatabase = Field(exclude=True)
    context: List[dict] | None = Field(exclude=True, default=None)
    few_shot_examples: List[dict] | None = Field(exclude=True, default=None)
    instructions: List[dict] | None = Field(exclude=True, default=None)
    db_scan: List[TableDescription] = Field(exclude=True)
    embedding: OpenAIEmbeddings = Field(exclude=True)
    is_multiple_schema: bool = False

    @property
    def dialect(self) -> str:
        """Return string representation of SQL dialect to use."""
        return self.db.dialect

    class Config:
        """Configuration for this pydantic object."""

        arbitrary_types_allowed = True

    def get_tools(self) -> List[BaseTool]:
        """Get the tools in the toolkit."""
        tools = []
        query_sql_db_tool = QuerySQLDataBaseTool(db=self.db, context=self.context)
        tools.append(query_sql_db_tool)
        if self.instructions is not None:
            tools.append(
                GetUserInstructions(
                    db=self.db, context=self.context, instructions=self.instructions
                )
            )
        get_current_datetime = SystemTime(db=self.db, context=self.context)
        tools.append(get_current_datetime)
        tables_sql_db_tool = TablesSQLDatabaseTool(
            db=self.db,
            context=self.context,
            db_scan=self.db_scan,
            embedding=self.embedding,
            few_shot_examples=self.few_shot_examples,
        )
        tools.append(tables_sql_db_tool)
        schema_sql_db_tool = SchemaSQLDatabaseTool(
            db=self.db, context=self.context, db_scan=self.db_scan
        )
        tools.append(schema_sql_db_tool)
        info_relevant_tool = InfoRelevantColumns(
            db=self.db, context=self.context, db_scan=self.db_scan
        )
        tools.append(info_relevant_tool)
        column_sample_tool = ColumnEntityChecker(
            db=self.db,
            context=self.context,
            db_scan=self.db_scan,
            is_multiple_schema=self.is_multiple_schema,
        )
        tools.append(column_sample_tool)
        if self.few_shot_examples is not None:
            get_fewshot_examples_tool = GetFewShotExamples(
                db=self.db,
                context=self.context,
                few_shot_examples=self.few_shot_examples,
            )
            tools.append(get_fewshot_examples_tool)
        return tools

    def get_followup_query_tools(self) -> List[BaseTool]:
        """Get the tools for followup queries in the toolkit."""
        tools = []
        followup_query_tool = QuerySimpleSQLTool(db=self.db, context=self.context)
        tools.append(followup_query_tool)
        query_sql_db_tool = QuerySQLDataBaseTool(db=self.db, context=self.context)
        tools.append(query_sql_db_tool)
        if self.instructions is not None:
            tools.append(
                GetUserInstructions(
                    db=self.db, context=self.context, instructions=self.instructions
                )
            )
        get_current_datetime = SystemTime(db=self.db, context=self.context)
        tools.append(get_current_datetime)
        tables_sql_db_tool = TablesSQLDatabaseTool(
            db=self.db,
            context=self.context,
            db_scan=self.db_scan,
            embedding=self.embedding,
            few_shot_examples=self.few_shot_examples,
        )
        tools.append(tables_sql_db_tool)
        schema_sql_db_tool = SchemaSQLDatabaseTool(
            db=self.db, context=self.context, db_scan=self.db_scan
        )
        tools.append(schema_sql_db_tool)
        info_relevant_tool = InfoRelevantColumns(
            db=self.db, context=self.context, db_scan=self.db_scan
        )
        tools.append(info_relevant_tool)
        column_sample_tool = ColumnEntityChecker(
            db=self.db,
            context=self.context,
            db_scan=self.db_scan,
            is_multiple_schema=self.is_multiple_schema,
        )
        tools.append(column_sample_tool)
        if self.few_shot_examples is not None:
            get_fewshot_examples_tool = GetFewShotExamples(
                db=self.db,
                context=self.context,
                few_shot_examples=self.few_shot_examples,
            )
            tools.append(get_fewshot_examples_tool)
        return tools

class DataheraldSQLAgent(SQLGenerator):
    """Dataherald SQL agent"""

    max_number_of_examples: int = 5  # maximum number of question/SQL pairs
    llm: Any = None

    def remove_duplicate_examples(self, fewshot_exmaples: List[dict]) -> List[dict]:
        returned_result = []
        seen_list = []
        for example in fewshot_exmaples:
            if example["prompt_text"] not in seen_list:
                seen_list.append(example["prompt_text"])
                returned_result.append(example)
        return returned_result

    def create_sql_agent(
        self,
        toolkit: SQLDatabaseToolkit,
        callback_manager: BaseCallbackManager | None = None,
        prefix: str = AGENT_PREFIX,
        suffix: str | None = None,
        format_instructions: str = FORMAT_INSTRUCTIONS,
        input_variables: List[str] | None = None,
        max_examples: int = 10,
        number_of_instructions: int = 1,
        max_iterations: int | None = int(
            os.getenv("AGENT_MAX_ITERATIONS", "3")
        ),  # noqa: B008
        max_execution_time: float | None = None,
        early_stopping_method: str = "generate",
        verbose: bool = False,
        agent_executor_kwargs: Dict[str, Any] | None = None,
        **kwargs: Dict[str, Any],
    ) -> AgentExecutor:
        """Construct an SQL agent from an LLM and tools."""
        tools = toolkit.get_tools()
        if max_examples > 0 and number_of_instructions > 0:
            plan = PLAN_WITH_FEWSHOT_EXAMPLES_AND_INSTRUCTIONS
            suffix = SUFFIX_WITH_FEW_SHOT_SAMPLES
        elif max_examples > 0:
            plan = PLAN_WITH_FEWSHOT_EXAMPLES
            suffix = SUFFIX_WITH_FEW_SHOT_SAMPLES
        elif number_of_instructions > 0:
            plan = PLAN_WITH_INSTRUCTIONS
            suffix = SUFFIX_WITHOUT_FEW_SHOT_SAMPLES
        else:
            plan = PLAN_BASE
            suffix = SUFFIX_WITHOUT_FEW_SHOT_SAMPLES
        plan = plan.format(
            dialect=toolkit.dialect,
            max_examples=max_examples,
        )
        prefix = prefix.format(
            dialect=toolkit.dialect, max_examples=max_examples, agent_plan=plan
        )
        prompt = ZeroShotAgent.create_prompt(
            tools,
            prefix=prefix,
            suffix=suffix,
            format_instructions=format_instructions,
            input_variables=input_variables,
        )
        llm_chain = LLMChain(
            llm=self.llm,
            prompt=prompt,
            callback_manager=callback_manager,
        )
        tool_names = [tool.name for tool in tools]
        agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names, **kwargs)
        return AgentExecutor.from_agent_and_tools(
            agent=agent,
            tools=tools,
            callback_manager=callback_manager,
            verbose=verbose,
            max_iterations=max_iterations,
            max_execution_time=max_execution_time,
            early_stopping_method=early_stopping_method,
            **(agent_executor_kwargs or {}),
        )

    @override
    def generate_response(  # noqa: PLR0912
        self,
        user_prompt: Prompt,
        database_connection: DatabaseConnection,
        context: List[dict] = None,
        metadata: dict = None,
    ) -> SQLGeneration:  # noqa: PLR0912
        context_store = self.system.instance(ContextStore)
        storage = self.system.instance(DB)
        response = SQLGeneration(
            prompt_id=user_prompt.id,
            llm_config=self.llm_config,
            created_at=datetime.datetime.now(),
        )
        self.llm = self.model.get_model(
            database_connection=database_connection,
            temperature=0,
            model_name=self.llm_config.llm_name,
            api_base=self.llm_config.api_base,
        )
        repository = TableDescriptionRepository(storage)
        db_scan = repository.get_all_tables_by_db(
            {
                "db_connection_id": str(database_connection.id),
                "status": TableDescriptionStatus.SCANNED.value,
            }
        )
        if not db_scan:
            raise ValueError("No scanned tables found for database")
        db_scan = SQLGenerator.filter_tables_by_schema(
            db_scan=db_scan, prompt=user_prompt
        )
        few_shot_examples, instructions = context_store.retrieve_context_for_question(
            user_prompt, number_of_samples=self.max_number_of_examples
        )
        if few_shot_examples is not None:
            new_fewshot_examples = self.remove_duplicate_examples(few_shot_examples)
            number_of_samples = len(new_fewshot_examples)
        else:
            new_fewshot_examples = None
            number_of_samples = 0
        logger.info(f"Generating SQL response to question: {str(user_prompt.dict())}")
        self.database = SQLDatabase.get_sql_engine(database_connection)
        # Set Embeddings class depending on azure / not azure
        if self.system.settings["azure_api_key"] is not None:
            toolkit = SQLDatabaseToolkit(
                db=self.database,
                context=context,
                few_shot_examples=new_fewshot_examples,
                instructions=instructions,
                is_multiple_schema=True if user_prompt.schemas else False,
                db_scan=db_scan,
                embedding=AzureOpenAIEmbeddings(
                    openai_api_key=database_connection.decrypt_api_key(),
                    model=EMBEDDING_MODEL,
                ),
            )
        else:
            toolkit = SQLDatabaseToolkit(
                db=self.database,
                context=context,
                few_shot_examples=new_fewshot_examples,
                instructions=instructions,
                is_multiple_schema=True if user_prompt.schemas else False,
                db_scan=db_scan,
                embedding=OpenAIEmbeddings(
                    openai_api_key=database_connection.decrypt_api_key(),
                    model=EMBEDDING_MODEL,
                ),
            )
        agent_executor = self.create_sql_agent(
            toolkit=toolkit,
            verbose=True,
            max_examples=number_of_samples,
            number_of_instructions=len(None) if None is not None else 0,
            max_execution_time=int(os.environ.get("DH_ENGINE_TIMEOUT", 200)),
        )
        agent_executor.return_intermediate_steps = True
        agent_executor.handle_parsing_errors = ERROR_PARSING_MESSAGE
        with get_openai_callback() as cb:
            try:
                result = agent_executor.invoke(
                    {"input": user_prompt.text}, {"metadata": metadata}
                )
                result = self.check_for_time_out_or_tool_limit(result)
            except SQLInjectionError as e:
                raise SQLInjectionError(e) from e
            except EngineTimeOutORItemLimitError as e:
                raise EngineTimeOutORItemLimitError(e) from e
            except Exception as e:
                return SQLGeneration(
                    prompt_id=user_prompt.id,
                    tokens_used=cb.total_tokens,
                    completed_at=datetime.datetime.now(),
                    sql="",
                    status="INVALID",
                    error=str(e),
                )
        sql_query = ""
        if "```sql" in result["output"]:
            sql_query = self.remove_markdown(result["output"])
        else:
            sql_query = self.extract_query_from_intermediate_steps(
                result["intermediate_steps"]
            )
        logger.info(f"cost: {str(cb.total_cost)} tokens: {str(cb.total_tokens)}")
        response.sql = replace_unprocessable_characters(sql_query)
        response.tokens_used = cb.total_tokens
        response.completed_at = datetime.datetime.now()
        if number_of_samples > 0:
            suffix = SUFFIX_WITH_FEW_SHOT_SAMPLES
        else:
            suffix = SUFFIX_WITHOUT_FEW_SHOT_SAMPLES
        response.intermediate_steps = self.construct_intermediate_steps(
            result["intermediate_steps"], suffix=suffix
        )
        return self.create_sql_query_status(
            self.database,
            response.sql,
            response,
        )

    def generate_followup_response(
        self,
        user_prompt: Prompt,
        database_connection: DatabaseConnection,
        context: List[dict] = None,
        metadata: dict = None,
    ) -> SQLGeneration:  # noqa: PLR0912
        context_store = self.system.instance(ContextStore)
        storage = self.system.instance(DB)
        response = SQLGeneration(
            prompt_id=user_prompt.id,
            llm_config=self.llm_config,
            created_at=datetime.datetime.now(),
        )
        self.llm = self.model.get_model(
            database_connection=database_connection,
            temperature=0,
            model_name=self.llm_config.llm_name,
            api_base=self.llm_config.api_base,
        )
        repository = TableDescriptionRepository(storage)
        db_scan = repository.get_all_tables_by_db(
            {
                "db_connection_id": str(database_connection.id),
                "status": TableDescriptionStatus.SCANNED.value,
            }
        )
        if not db_scan:
            raise ValueError("No scanned tables found for database")
        db_scan = SQLGenerator.filter_tables_by_schema(
            db_scan=db_scan, prompt=user_prompt
        )
        few_shot_examples, instructions = context_store.retrieve_context_for_question(
            user_prompt, number_of_samples=self.max_number_of_examples
        )
        if few_shot_examples is not None:
            new_fewshot_examples = self.remove_duplicate_examples(few_shot_examples)
            number_of_samples = len(new_fewshot_examples)
        else:
            new_fewshot_examples = None
            number_of_samples = 0
        logger.info(f"Generating SQL response to question: {str(user_prompt.dict())}")
        self.database = SQLDatabase.get_sql_engine(database_connection)
        # Set Embeddings class depending on azure / not azure
        if self.system.settings["azure_api_key"] is not None:
            toolkit = SQLDatabaseToolkit(
                db=self.database,
                context=context,
                few_shot_examples=new_fewshot_examples,
                instructions=instructions,
                is_multiple_schema=True if user_prompt.schemas else False,
                db_scan=db_scan,
                embedding=AzureOpenAIEmbeddings(
                    openai_api_key=database_connection.decrypt_api_key(),
                    model=EMBEDDING_MODEL,
                ),
            )
        else:
            toolkit = SQLDatabaseToolkit(
                db=self.database,
                context=context,
                few_shot_examples=new_fewshot_examples,
                instructions=instructions,
                is_multiple_schema=True if user_prompt.schemas else False,
                db_scan=db_scan,
                embedding=OpenAIEmbeddings(
                    openai_api_key=database_connection.decrypt_api_key(),
                    model=EMBEDDING_MODEL,
                ),
            )
        agent_executor = self.create_followup_sql_agent(
            toolkit=toolkit,
            verbose=True,
            max_examples=number_of_samples,
            number_of_instructions=len(None) if None is not None else 0,
            max_execution_time=int(os.environ.get("DH_ENGINE_TIMEOUT", 200)),
        )
        agent_executor.return_intermediate_steps = True
        agent_executor.handle_parsing_errors = ERROR_PARSING_MESSAGE
        with get_openai_callback() as cb:
            try:
                result = agent_executor.invoke(
                    {"input": user_prompt.text}, {"metadata": metadata}
                )
                result = self.check_for_time_out_or_tool_limit(result)
            except SQLInjectionError as e:
                raise SQLInjectionError(e) from e
            except EngineTimeOutORItemLimitError as e:
                raise EngineTimeOutORItemLimitError(e) from e
            except Exception as e:
                return SQLGeneration(
                    prompt_id=user_prompt.id,
                    tokens_used=cb.total_tokens,
                    completed_at=datetime.datetime.now(),
                    sql="",
                    status="INVALID",
                    error=str(e),
                )
        sql_query = ""
        if "```sql" in result["output"]:
            sql_query = self.remove_markdown(result["output"])
        else:
            sql_query = self.extract_query_from_intermediate_steps(
                result["intermediate_steps"]
            )
        logger.info(f"cost: {str(cb.total_cost)} tokens: {str(cb.total_tokens)}")
        response.sql = replace_unprocessable_characters(sql_query)
        response.tokens_used = cb.total_tokens
        response.completed_at = datetime.datetime.now()
        if number_of_samples > 0:
            suffix = SUFFIX_WITH_FEW_SHOT_SAMPLES
        else:
            suffix = SUFFIX_WITHOUT_FEW_SHOT_SAMPLES
        response.intermediate_steps = self.construct_intermediate_steps(
            result["intermediate_steps"], suffix=suffix
        )
        return self.create_sql_query_status(
            self.database,
            response.sql,
            response,
        )

    @override
    def stream_response(
        self,
        user_prompt: Prompt,
        database_connection: DatabaseConnection,
        response: SQLGeneration,
        queue: Queue,
        metadata: dict = None,
    ):
        context_store = self.system.instance(ContextStore)
        storage = self.system.instance(DB)
        sql_generation_repository = SQLGenerationRepository(storage)
        self.llm = self.model.get_model(
            database_connection=database_connection,
            temperature=0,
            model_name=self.llm_config.llm_name,
            api_base=self.llm_config.api_base,
            streaming=True,
        )
        repository = TableDescriptionRepository(storage)
        db_scan = repository.get_all_tables_by_db(
            {
                "db_connection_id": str(database_connection.id),
                "status": TableDescriptionStatus.SCANNED.value,
            }
        )
        if not db_scan:
            raise ValueError("No scanned tables found for database")
        db_scan = SQLGenerator.filter_tables_by_schema(
            db_scan=db_scan, prompt=user_prompt
        )
        few_shot_examples, instructions = context_store.retrieve_context_for_question(
            user_prompt, number_of_samples=self.max_number_of_examples
        )
        if few_shot_examples is not None:
            new_fewshot_examples = self.remove_duplicate_examples(few_shot_examples)
            number_of_samples = len(new_fewshot_examples)
        else:
            new_fewshot_examples = None
            number_of_samples = 0
        self.database = SQLDatabase.get_sql_engine(database_connection)
        # Set Embeddings class depending on azure / not azure
        if self.system.settings["azure_api_key"] is not None:
            embedding = AzureOpenAIEmbeddings(
                openai_api_key=database_connection.decrypt_api_key(),
                model=EMBEDDING_MODEL,
            )
        else:
            embedding = OpenAIEmbeddings(
                openai_api_key=database_connection.decrypt_api_key(),
                model=EMBEDDING_MODEL,
            )
        toolkit = SQLDatabaseToolkit(
            queuer=queue,
            db=self.database,
            context=[{}],
            few_shot_examples=new_fewshot_examples,
            instructions=instructions,
            is_multiple_schema=True if user_prompt.schemas else False,
            db_scan=db_scan,
            embedding=embedding,
        )
        agent_executor = self.create_sql_agent(
            toolkit=toolkit,
            verbose=True,
            max_examples=number_of_samples,
            number_of_instructions=len(instructions) if instructions is not None else 0,
            max_execution_time=int(os.environ.get("DH_ENGINE_TIMEOUT", 150)),
        )
        agent_executor.return_intermediate_steps = True
        agent_executor.handle_parsing_errors = ERROR_PARSING_MESSAGE
        thread = Thread(
            target=self.stream_agent_steps,
            args=(
                user_prompt.text,
                agent_executor,
                response,
                sql_generation_repository,
                queue,
                metadata,
            ),
        )
        thread.start()

    # SQL Agent for simple follow-up queries (simple agent)
    def create_simple_sql_agent(self, toolkit: 'SQLDatabaseToolkit', llm: Any = None) -> 'AgentExecutor':
        """
        Create a minimal SQL agent for follow-up queries, using only the LLM and toolkit tools.
        """
        tools = toolkit.get_followup_query_tools()
        prompt = ZeroShotAgent.create_prompt(
            tools,
            prefix="You are a SQL expert. Given a question, generate a simple SELECT * FROM table LIMIT 10 for each table involved.",
            suffix="Begin!\n\nQuestion: {input}\nThought: Identify tables and generate queries.\n{agent_scratchpad}",
            format_instructions="Use the following format:\nQuestion: ...\nThought: ...\nAction: ...\nAction Input: ...\nObservation: ...\nFinal Answer: ...",
            input_variables=["input", "agent_scratchpad"],
        )
        llm_chain = LLMChain(
            llm=llm or self.llm,
            prompt=prompt,
        )
        tool_names = [tool.name for tool in tools]
        agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names)
        return AgentExecutor.from_agent_and_tools(
            agent=agent,
            tools=tools,
            verbose=True,
        )

    # SQL Agent for follow-up queries (same as dataherald_sql_agent.create_sql_agent)
    def create_followup_sql_agent(
        self,
        toolkit: SQLDatabaseToolkit,
        callback_manager: BaseCallbackManager | None = None,
        prefix: str = AGENT_PREFIX,
        suffix: str | None = None,
        format_instructions: str = FORMAT_INSTRUCTIONS,
        input_variables: List[str] | None = None,
        max_examples: int = 10,
        number_of_instructions: int = 1,
        max_iterations: int | None = int(
            os.getenv("AGENT_MAX_ITERATIONS", "3")
        ),  # noqa: B008
        max_execution_time: float | None = None,
        early_stopping_method: str = "generate",
        verbose: bool = False,
        agent_executor_kwargs: Dict[str, Any] | None = None,
        **kwargs: Dict[str, Any],
    ) -> AgentExecutor:
        """Construct an SQL agent from an LLM and tools."""
        tools = toolkit.get_followup_query_tools()
        if max_examples > 0 and number_of_instructions > 0:
            plan = PLAN_WITH_FEWSHOT_EXAMPLES_AND_INSTRUCTIONS
            suffix = SUFFIX_WITH_FEW_SHOT_SAMPLES
        elif max_examples > 0:
            plan = PLAN_WITH_FEWSHOT_EXAMPLES
            suffix = SUFFIX_WITH_FEW_SHOT_SAMPLES
        elif number_of_instructions > 0:
            plan = PLAN_WITH_INSTRUCTIONS
            suffix = SUFFIX_WITHOUT_FEW_SHOT_SAMPLES
        else:
            plan = PLAN_BASE
            suffix = SUFFIX_WITHOUT_FEW_SHOT_SAMPLES
        plan = plan.format(
            dialect=toolkit.dialect,
            max_examples=max_examples,
        )
        prefix = prefix.format(
            dialect=toolkit.dialect, max_examples=max_examples, agent_plan=plan
        )
        prompt = ZeroShotAgent.create_prompt(
            tools,
            prefix=prefix,
            suffix=suffix,
            format_instructions=format_instructions,
            input_variables=input_variables,
        )
        llm_chain = LLMChain(
            llm=self.llm,
            prompt=prompt,
            callback_manager=callback_manager,
        )
        tool_names = [tool.name for tool in tools]
        agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names, **kwargs)
        return AgentExecutor.from_agent_and_tools(
            agent=agent,
            tools=tools,
            callback_manager=callback_manager,
            verbose=verbose,
            max_iterations=max_iterations,
            max_execution_time=max_execution_time,
            early_stopping_method=early_stopping_method,
            **(agent_executor_kwargs or {}),
        )

