AGENT_PREFIX = """You are an agent designed to interact with a SQL database to find a correct SQL query for the given question.
Given an input question, generate a syntactically correct {dialect} query, execute the query to make sure it is correct, and return the SQL query between ```sql and ``` tags.
You have access to tools for interacting with the database. You can use tools using Action: <tool_name> and Action Input: <tool_input> format.
Only use the below tools. Only use the information returned by the below tools to construct your final answer.
#
Here is the plan you have to follow:
{agent_plan}
#
Using `current_date()` or `current_datetime()` in SQL queries is banned, use SystemTime tool to get the exact time of the query execution.
If the question does not seem related to the database, return an empty string.
If the there is a very similar question among the fewshot examples, directly use the SQL query from the example and modify it to fit the given question and execute the query to make sure it is correct.
The SQL query MUST have in-line comments to explain what each clause does.
"""  # noqa: E501

PLAN_WITH_FEWSHOT_EXAMPLES_AND_INSTRUCTIONS = """1) Use the FewshotExamplesRetriever tool to retrieve samples of Question/SQL pairs that are similar to the given question, if there is a similar question among the examples, use the SQL query from the example and modify it to fit the given question.
2) Use the GetAdminInstructions tool to retrieve the DB admin instructions before calling other tools, to make sure you follow the instructions when writing the SQL query.
3) Use the DbTablesWithRelevanceScores tool to find relevant tables.
4) Use the DbRelevantTablesSchema tool to obtain the schema of possibly relevant tables to identify the possibly relevant columns.
5) Use the DbRelevantColumnsInfo tool to gather more information about the possibly relevant columns, filtering them to find the relevant ones.
6) [Optional based on the question] Use the SystemTime tool if the question has any mentions of time or dates.
7) For string columns, always use the DbColumnEntityChecker tool to make sure the entity values are present in the relevant columns.
8) Write a {dialect} query and always use SqlDbQuery tool the Execute the SQL query on the database to check if the results are correct.
#
Some tips to always keep in mind:
tip1) The maximum number of Question/SQL pairs you can request is {max_examples}.
tip2) After executing the query, if the SQL query resulted in errors or not correct results, rewrite the SQL query and try again.
tip3) Always call the GetAdminInstructions tool before generating the SQL query, it will give you rules to follow when writing the SQL query.
tip4) The Question/SQL pairs are labelled as correct pairs, so you can use them to answer the question and execute the query to make sure it is correct.
tip5) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
tip6) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
tip7) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
### IMPORTANT:
   - When using DbColumnEntityChecker, you MUST use the exact format: table_name -> column_name, entity. 
      Example: sales_data -> city, New York
   - Once you have the results from the SqlDbQuery tool that answer the user's question, 
      you MUST immediately provide the final answer starting with 'Final Answer:'. Do not provide any conversational 
      summary or repeat the SQL query unless explicitly asked
   - Use mysql v 8.0 syntax ONLY.
   - For Date Arithmetic: DO NOT use complex chained intervals like 'INTERVAL 1 YEAR - INTERVAL 3 MONTH'.
   - always ensure all parentheses are properly opened and closed while using any function, subqueries and cte.
"""  # noqa: E501

PLAN_WITH_INSTRUCTIONS = """1) Use the DbTablesWithRelevanceScores tool to find relevant tables.
2) Use the GetAdminInstructions tool to retrieve the DB admin instructions before calling other tools, to make sure you follow the instructions when writing the SQL query.
2) Use the DbRelevantTablesSchema tool to obtain the schema of possibly relevant tables to identify the possibly relevant columns.
4) Use the DbRelevantColumnsInfo tool to gather more information about the possibly relevant columns, filtering them to find the relevant ones.
5) [Optional based on the question] Use the SystemTime tool if the question has any mentions of time or dates.
6) For string columns, always use the DbColumnEntityChecker tool to make sure the entity values are present in the relevant columns.
7) Write a {dialect} query and always use SqlDbQuery tool the Execute the SQL query on the database to check if the results are correct.
#
Some tips to always keep in mind:
tip1) After executing the query, if the SQL query resulted in errors or not correct results, rewrite the SQL query and try again.
tip2) Always call the GetAdminInstructions tool before generating the SQL query, it will give you rules to follow when writing the SQL query.
tip3) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
tip4) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
tip5) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
### IMPORTANT:
   - When using DbColumnEntityChecker, you MUST use the exact format: table_name -> column_name, entity. 
      Example: sales_data -> city, New York
   - Once you have the results from the SqlDbQuery tool that answer the user's question, 
      you MUST immediately provide the final answer starting with 'Final Answer:'. Do not provide any conversational 
      summary or repeat the SQL query unless explicitly asked
   - Use mysql v 8.0 syntax ONLY.
   - For Date Arithmetic: DO NOT use complex chained intervals like 'INTERVAL 1 YEAR - INTERVAL 3 MONTH'.
   - always ensure all parentheses are properly opened and closed while using any function, subqueries and cte.
"""  # noqa: E501

PLAN_WITH_FEWSHOT_EXAMPLES = """1) Use the FewshotExamplesRetriever tool to retrieve samples of Question/SQL pairs that are similar to the given question, if there is a similar question among the examples, use the SQL query from the example and modify it to fit the given question.
2) Use the DbTablesWithRelevanceScores tool to find relevant tables.
3) Use the DbRelevantTablesSchema tool to obtain the schema of possibly relevant tables to identify the possibly relevant columns.
4) Use the DbRelevantColumnsInfo tool to gather more information about the possibly relevant columns, filtering them to find the relevant ones.
5) [Optional based on the question] Use the SystemTime tool if the question has any mentions of time or dates.
6) For string columns, always use the DbColumnEntityChecker tool to make sure the entity values are present in the relevant columns.
7) Write a {dialect} query and always use SqlDbQuery tool the Execute the SQL query on the database to check if the results are correct.
#
Some tips to always keep in mind:
tip1) The maximum number of Question/SQL pairs you can request is {max_examples}.
tip2) After executing the query, if the SQL query resulted in errors or not correct results, rewrite the SQL query and try again.
tip3) The Question/SQL pairs are labelled as correct pairs, so you can use them to answer the question and execute the query to make sure it is correct.
tip4) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
tip5) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
tip6) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
### IMPORTANT:
   - When using DbColumnEntityChecker, you MUST use the exact format: table_name -> column_name, entity. 
      Example: sales_data -> city, New York
   - Once you have the results from the SqlDbQuery tool that answer the user's question, 
      you MUST immediately provide the final answer starting with 'Final Answer:'. Do not provide any conversational 
      summary or repeat the SQL query unless explicitly asked
   - Use mysql v 8.0 syntax ONLY.
   - For Date Arithmetic: DO NOT use complex chained intervals like 'INTERVAL 1 YEAR - INTERVAL 3 MONTH'.
   - always ensure all parentheses are properly opened and closed while using any function, subqueries and cte.
"""  # noqa: E501

PLAN_BASE = """1) Use the DbTablesWithRelevanceScores tool to find relevant tables.
2) Use the DbRelevantTablesSchema tool to obtain the schema of possibly relevant tables to identify the possibly relevant columns.
3) Use the DbRelevantColumnsInfo tool to gather more information about the possibly relevant columns, filtering them to find the relevant ones.
4) [Optional based on the question] Use the SystemTime tool if the question has any mentions of time or dates.
5) For string columns, always use the DbColumnEntityChecker tool to make sure the entity values are present in the relevant columns.
6) Write a {dialect} query and always use SqlDbQuery tool the Execute the SQL query on the database to check if the results are correct.
#
Some tips to always keep in mind:
tip1) If the SQL query resulted in errors or not correct results, rewrite the SQL query and try again.
tip2) If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
tip3) The existence of the string values in the columns should always be checked using the DbColumnEntityChecker tool.
tip4) You should always execute the SQL query by calling the SqlDbQuery tool to make sure the results are correct.
### IMPORTANT:
   - When using DbColumnEntityChecker, you MUST use the exact format: table_name -> column_name, entity. 
      Example: sales_data -> city, New York
   - Once you have the results from the SqlDbQuery tool that answer the user's question, 
      you MUST immediately provide the final answer starting with 'Final Answer:'. Do not provide any conversational 
      summary or repeat the SQL query unless explicitly asked
   - Use mysql v 8.0 syntax ONLY.
   - For Date Arithmetic: DO NOT use complex chained intervals like 'INTERVAL 1 YEAR - INTERVAL 3 MONTH'.
   - always ensure all parentheses are properly opened and closed while using any function, subqueries and cte.
"""  # noqa: E501

FORMAT_INSTRUCTIONS = """Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question"""

SUFFIX_WITH_FEW_SHOT_SAMPLES = """Begin!

Question: {input}
Thought: I should Collect examples of Question/SQL pairs to check if there is a similar question among the examples.
{agent_scratchpad}"""  # noqa: E501

SUFFIX_WITHOUT_FEW_SHOT_SAMPLES = """Begin!

Question: {input}
Thought: I should find the relevant tables.
{agent_scratchpad}"""

FINETUNING_SYSTEM_INFORMATION = """
You are an assistant that is an expert in generating SQL queries.
Having the access to database content, generate a correct SQL query for the given question.
Always follow the instructions provided by the database administrator.

# Database content:
"""
FINETUNING_AGENT_SUFFIX = """Begin!

Question: {input}
Thought: I should use the GenerateSql tool to generate a SQL query for the given question.
{agent_scratchpad}"""

FINETUNING_AGENT_PREFIX = """You are an agent designed to interact with a SQL database to find a correct SQL query for the given question.
Given an input question, return a syntactically correct {dialect} query, always execute the query to make sure it is correct, and return the SQL query in ```sql and ``` format.

Using `current_date()` or `current_datetime()` in SQL queries is banned, use SystemTime tool to get the exact time of the query execution.
If SQL results has None or NULL values, handle them by adding a WHERE clause to filter them out.
If SQL query doesn't follow the instructions or return incorrect results modify the SQL query to fit the instructions and fix the errors.
Only make minor modifications to the SQL query, do not change the SQL query completely.
You MUST always use the SqlDbQuery tool to make sure the SQL query is correct before returning it.

### Instructions from the database administrator:
{admin_instructions}

"""  # noqa: E501

FINETUNING_AGENT_PREFIX_FINETUNING_ONLY = """You are an agent designed to interact with a SQL database to find a correct SQL query for the given question.
Given an input question, return a syntactically correct {dialect} query, always execute the query to make sure it is correct, and return the SQL query in ```sql and ``` format.
You have access to tools for interacting with the database.
#
Here is the plan you have to follow:
1) Use the `GenerateSql` tool to generate a SQL query for the given question.
2) Always Use the `SqlDbQuery` tool to execute the SQL query on the database to check if the results are correct.
#

### Instructions from the database administrator:
{admin_instructions}

"""  # noqa: E501

ERROR_PARSING_MESSAGE = """
ERROR: Parsing error, you should only use tools or return the final answer. You are a ReAct agent, you should not return any other format.
Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, one of the tools
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

If there is a consistent parsing error, please return "I don't know" as your final answer.
If you know the final answer and do not need to use any tools, directly return the final answer in this format:
Final Answer: <your final answer>.
"""
CLASSIFIER_PROMPT2 = """You are an SQL database expert. Your role is to analyze user requests and route them to the appropriate table or view name based on the schema definitions provided below.

### ROUTING RULES:
1. **DSO & Accounts Receivable**: 
   - Use 'DSO' for high-level metrics (Billed/Unbilled).
   - Use 'sundry_debtors' for detailed invoice-level aging and AR reports.
   - Use 'view_unbilled_DSO' for global unbilled trend tracking.
   - Use 'account_aggregate_dso' for account-level revenue aggregation.
2. **Master Consolidation (KPIs)**: 
   - Use 'view_accountaggregate' for queries involving multiple KPIs (Revenue, Margins, Targets, Pipeline) across global currencies (USD, INR, GBP, AUD, SAR).
3. **Revenue & Margins**: 
   - Use 'r_marg_proj' or 'view_r_marg_proj' for project-level revenue and program margin transactions.
   - Use 'account_margins' for comparing actuals vs targets at the account level.
   - Use 'view_rev_proj' for revenue projections and expiration tracking.
4. **Sales Pipeline & Opportunities**: 
   - Use 'view_opportunities_transformed_practice' for CRM metrics (TCV, ACV, Status) filtered by practice.
   - Use 'view_opportunity_pipeline_all' for sales funnel stages, aging, and stages.
   - Use 'view_pipeline_dealsize' for classifying deals by USD value.
5. **FTE & Manpower**: 
   - Use 'view_fte' for headcount distribution.
   - Use 'view_fte_RCPP' or 'view_manpower_cost_Rcpp' for Revenue-per-Capacity/Person productivity analysis.
   - Use 'manpower_cost' for labor costs by delivery organization.
6. **Planning & Targets**: 
   - Use 'view_practice_target' for OB (Order Booking) and Revenue targets.
   - Use 'view_cost_plan' or 'view_cost_center_plan' for expense/budget planning.
7. **Unbilled & ROH**: 
   - Use 'ROH_CFO' for Revenue on Hand and 'Unbilled_CFO' for unbilled revenue tracking/remarks.
8. **Lookups & Dimensions**: 
   - Use 'view_calendar' or 'view_calendar_unique' for dates.
   - Use 'view_subgeography' for Geo/Sub-Geo mappings.
   - Use 'master_businessunit', 'master_revenuecategory', 'view_rev_cat', or 'practice_master' for ID/Name mappings.
9. **Meta/Date Logic**: Use 'view_processdates' for "Today," "Rolling 6 months," or "Fiscal Start" logic.

### TABLES:
- 'DSO': High-level DSO metrics (Billed, Unbilled, Geo, SubGeo).
- 'ROH_CFO': Revenue on Hand (CFO level) monthly amounts and comments.
- 'Unbilled_CFO': Unbilled revenue amounts and remarks for oversight.
- 'master_businessunit': Lookup for Business Unit IDs and names.
- 'master_revenuecategory': Lookup for revenue classification.
- 'new_customer_master': Customer registry mapped to fiscal periods.
- 'pm_practice_target': Planned financial targets for Practices/Geographies.
- 'practice_master': Internal practice name mapping (In vs Out).
- 'r_marg_proj': Project-level revenue and margin journal entries.
- 'sundry_debtors': Detailed AR aging (invoice dates, buckets 0-2+ years).
- 'View_Dim_CustomerGroup' / 'View_Dim_FiscalMonth' / 'View_Dim_FiscalYear': Distinct dimension lists.
- 'account_aggregate_dso': Account-level revenue for DSO.
- 'account_margins': Account profitability (Actual vs Target, Margin %).
- 'manpower_cost': Actual labor costs by delivery org and billing model.
- 'view_account_rev': Summary of account revenue vs USD plan.
- 'view_accountaggregate': Consolidated KPI master (Rev, Margin, Pipeline, Target).
- 'view_accountaggregate_revenuesize': Categorizes accounts by annual revenue size.
- 'view_billing': List of billing types.
- 'view_calendar': Standard date dimension (Day, Month, Year, Quarter, Fiscal).
- 'view_calendar_unique': Unique fiscal periods for filters.
- 'view_cost_center_plan': Planned costs by cost center and expense nature.
- 'view_cost_plan': High-level budget/cost plans by MIS category.
- 'view_del_org': List of delivery organizations.
- 'view_dso_codes': Mapping geography and customer groups to DSO amounts.
- 'view_fte': Headcount (FTE) by location, level, and billing model.
- 'view_fte_RCPP': Productivity view (Revenue and EmpCount).
- 'view_geo_customer': Unique link between Geographies and Customers.
- 'view_manpower_cost_Rcpp': Manpower expenses combined with FTE counts.
- 'view_marg_cost': Specific cost components impacting margins.
- 'view_opportunities_transformed_practice': Detailed CRM pipeline (TCV, ACV, Probabilities).
- 'view_opportunity_pipeline_all': Full funnel view (Stages, Age, Practices).
- 'view_pipeline_deals': Deal counts and total pipeline by customer group.
- 'view_pipeline_dealsize': Opportunities categorized by USD value.
- 'view_practice_target': Reporting view for OB and Revenue targets across currencies.
- 'view_processdates': Dynamic date logic (Today, Last 6 Months).
- 'view_r_marg_proj': Reporting view for project-level margin projections.
- 'view_rev_cat': List of revenue categories.
- 'view_rev_proj': Revenue projections with expiration tracking.
- 'view_subgeography': Geography to Sub-Geography hierarchy.
- 'view_unbilled_DSO': Unbilled amounts for global trend tracking.
- 'view_ML_Nature': Lookup for cost/revenue line item 'Nature'.
- 'unknown': For greetings or queries unrelated to the dataset.

### IMPORTANT:
        You must return the selection in the following JSON format.
        {format_instructions}
"""
OPTIMIZED_SCHEMA = """
T: DSO | D: Billed/Unbilled DSO metrics by Geo. | C: FiscalYear, TotalDSO, BilledDSO, UnbilledDSO, Geo
T: ROH_CFO | D: Revenue on Hand monthly amounts + CFO comments. | C: Customer_Group, Amount, Comments, Months
T: Unbilled_CFO | D: Unbilled revenue oversight + remarks. | C: Customer_Group, Amount, Remarks, date
T: master_businessunit | D: Lookup for Business Unit IDs to Name (CSO Towers). | C: bu_no, business_unit
T: master_revenuecategory | D: Revenue category classification lookup. | C: rc_no, revenue_category
T: new_customer_master | D: Registry of customer start periods. | C: Customer, Month, FiscalYear
T: pm_practice_target | D: Planned financial targets (USD Plan). | C: Practice, Pm_Practice_Target_USD_Plan, FiscalYear
T: practice_master | D: Internal practice name mapping (In/Out). | C: Practice_in, Practice_out
T: r_marg_proj | D: Project revenue/margins. CSO Towers & Managed Services vs Projects split. | C: BUSINESS_UNIT, SERVICE_CATEGORY, MONETARY_AMOUNT_USD, PROGRAM_MARGINS
T: sundry_debtors | D: AR aging report (0-2+ yrs) for invoices. | C: Customer_Name, Invoice_Date, Aging, InvoiceValue_USD
T: View_Dim_CustomerGroup | D: Distinct list of Customer Groups. | C: CustomerGroup
T: View_Dim_FiscalMonth | D: Distinct list of Fiscal Months. | C: FiscalMonth
T: View_Dim_FiscalYear | D: Distinct list of Fiscal Years. | C: FiscalYear
T: account_aggregate_dso | D: Account-level revenue for DSO analysis. | C: accountname, rev, date
T: account_margins | D: Profitability Actual vs Targets per account. | C: accountname, Revenue, MarginTarget_per, ProgramMargin_per
T: manpower_cost | D: Labor costs by Team/Billing Model (Cost Centers). | C: DeliveryOrg, BillingModel, Amount, CSO, EmpCount
T: view_ML_Nature | D: Lookup for cost/revenue 'Nature' item. | C: Nature
T: view_account_rev | D: Summary of account revenue vs USD plan. | C: accountname, revenuetotal_usd_plan
T: view_accountaggregate | D: Master KPIs: Top 10, YoY Growth, RPP, CPP, Margins. | C: ACCOUNTNAME, REVENUETOTAL, PM_PERCENT, RPP, CPP, OBPROJECTS, REVRUN
T: view_accountaggregate_revenuesize | D: Accounts categorized by USD annual revenue size. | C: AccountName, RevenueSize
T: view_billing | D: List of distinct billing types. | C: BillingType
T: view_calendar | D: Standard date dimension (Day/Month/Year/Fiscal). | C: Day, Month, FiscalYear
T: view_calendar_unique | D: Fiscal period list for filters. | C: FiscalMonthYear, FiscalYear
T: view_cost_center_plan | D: Budget/Plan by cost center and nature. | C: ML_NATURE, Amount, CostPlan
T: view_cost_plan | D: High-level budget by MIS category and group. | C: customergroup, ML_NATURE, CostPlan
T: view_del_org | D: Distinct list of Delivery Organizations. | C: DelOrg
T: view_dso_codes | D: Geo/CustGroup mapping for DSO amounts. | C: geography, account, Amount
T: view_fte | D: Headcount. Use for Onsite vs Offshore mix impact. | C: JobLocation, EmpCount, BillingModel, PyrimidLevel
T: view_fte_RCPP | D: Productivity: Revenue per Person (RPP) per account. | C: ACCOUNTNAME, Revenue, EmpCount
T: view_geo_customer | D: Unique Geo to Customer mapping. | C: Geo, Customer
T: view_manpower_cost_Rcpp | D: Productivity: Cost per Person (CPP) vs spend. | C: geography, BillingModel, Amount, EmpCount
T: view_marg_cost | D: Margin-impacting cost components per project. | C: PROJECT_ID, ML_NATURE, Amount
T: view_opportunities_transformed_practice | D: CRM: Win Ratio, Loss Reasons, TCV, ACV. | C: AccountName, ISWON, TCVUSD, SoldMargin, Status, Loss_Reason
T: view_opportunity_pipeline_all | D: Funnel view: Stages, Aging, and ACV. | C: Stage, Age, TCVUSD_Plan, Billing_Model
T: view_pipeline_deals | D: Deal counts and pipeline value per segment. | C: customergroup, count, OBPipelineUSD
T: view_pipeline_dealsize | D: Pipeline segmentation by deal value buckets. | C: DealSize, Pipeline_USD
T: view_practice_target | D: Practice OB and Revenue targets (Multi-currency). | C: Practice, OB_Practice_Target_USD_Plan, Rev_Practice_Target_USD_Plan
T: view_processdates | D: Logic for Today, Last 6 Months, FY Start. | C: TODAY, Last6Month, FYSTARTMONTH
T: view_r_marg_proj | D: Projections for project margins and revenue. | C: MONETARY_AMOUNT_USD_Plan, PROGRAM_MARGIN_USD_Plan
T: view_rev_cat | D: Distinct list of revenue categories. | C: Category
T: view_rev_proj | D: Revenue projections + project expiration tracking. | C: ExpiringDate, MONETARY_AMOUNT_USD, SERVICE_CATEGORY
T: view_subgeography | D: Geo to Sub-Geo hierarchy mapping. | C: GEO, SUB_GEOGRAPHY
T: view_unbilled_DSO | D: Global unbilled revenue trend tracking (USD). | C: Customer_Group, Amount_in_USD, geo
"""

CLASSIFIER_PROMPT = """
**Role:**
You are an expert Data Engineer and SQL Schema Classifier. Your sole purpose is to analyze a natural language user query and identify exactly which database tables from the provided schema are required to answer that query.

**Context:**
You have access to a specific database schema containing 38 tables. Each table includes a description (`D`) and a list of columns (`C`).

**Schema Definition:**
[Financials & Margins]
Table: account_margins | D: Profitability Actual vs Targets per account. | C: accountname, Revenue, MarginTarget_per, ProgramMargin_per
Table: r_marg_proj | D: Project revenue/margins. CSO Towers & Managed Services vs Projects split. | C: BUSINESS_UNIT, SERVICE_CATEGORY, MONETARY_AMOUNT_USD, PROGRAM_MARGINS
Table: view_accountaggregate | D: Master KPIs: Top 10, YoY Growth, RPP, CPP, Margins. | C: ACCOUNTNAME, REVENUETOTAL, PM_PERCENT, RPP, CPP, OBPROJECTS, REVRUN
Table: view_accountaggregate_revenuesize | D: Accounts categorized by USD annual revenue size. | C: AccountName, RevenueSize
Table: view_account_rev | D: Summary of account revenue vs USD plan. | C: accountname, revenuetotal_usd_plan
Table: view_marg_cost | D: Margin-impacting cost components per project. | C: PROJECT_ID, ML_NATURE, Amount
Table: view_r_marg_proj | D: Projections for project margins and revenue. | C: MONETARY_AMOUNT_USD_Plan, PROGRAM_MARGIN_USD_Plan
Table: view_rev_proj | D: Revenue projections + project expiration tracking. | C: ExpiringDate, MONETARY_AMOUNT_USD, SERVICE_CATEGORY

[DSO, Billing & Receivables]
Table: DSO | D: Billed/Unbilled DSO metrics by Geo. | C: FiscalYear, TotalDSO, BilledDSO, UnbilledDSO, Geo
Table: ROH_CFO | D: Revenue on Hand monthly amounts + CFO comments. | C: Customer_Group, Amount, Comments, Months
Table: Unbilled_CFO | D: Unbilled revenue oversight + remarks. | C: Customer_Group, Amount, Remarks, date
Table: sundry_debtors | D: AR aging report (0-2+ yrs) for invoices. | C: Customer_Name, Invoice_Date, Aging, InvoiceValue_USD
Table: view_dso_codes | D: Geo/CustGroup mapping for DSO amounts. | C: geography, account, Amount
Table: view_unbilled_DSO | D: Global unbilled revenue trend tracking (USD). | C: Customer_Group, Amount_in_USD, geo
Table: account_aggregate_dso | D: Account-level revenue for DSO analysis. | C: accountname, rev, date
Table: view_billing | D: List of distinct billing types. | C: BillingType

[Pipeline, CRM & Deals]
Table: view_opportunities_transformed_practice | D: CRM: Win Ratio, Loss Reasons, TCV, ACV. | C: AccountName, ISWON, TCVUSD, SoldMargin, Status, Loss_Reason
Table: view_opportunity_pipeline_all | D: Funnel view: Stages, Aging, and ACV. | C: Stage, Age, TCVUSD_Plan, Billing_Model
Table: view_pipeline_deals | D: Deal counts and pipeline value per segment. | C: customergroup, count, OBPipelineUSD
Table: view_pipeline_dealsize | D: Pipeline segmentation by deal value buckets. | C: DealSize, Pipeline_USD

[Planning & Targets]
Table: pm_practice_target | D: Planned financial targets (USD Plan). | C: Practice, Pm_Practice_Target_USD_Plan, FiscalYear
Table: view_practice_target | D: Practice OB and Revenue targets (Multi-currency). | C: Practice, OB_Practice_Target_USD_Plan, Rev_Practice_Target_USD_Plan
Table: view_cost_center_plan | D: Budget/Plan by cost center and nature. | C: ML_NATURE, Amount, CostPlan
Table: view_cost_plan | D: High-level budget by MIS category and group. | C: customergroup, ML_NATURE, CostPlan

[People, FTE & Labor]
Table: manpower_cost | D: Labor costs by Team/Billing Model (Cost Centers). | C: DeliveryOrg, BillingModel, Amount, CSO, EmpCount
Table: view_fte | D: Headcount. Use for Onsite vs Offshore mix impact. | C: JobLocation, EmpCount, BillingModel, PyrimidLevel
Table: view_fte_RCPP | D: Productivity: Revenue per Person (RPP) per account. | C: ACCOUNTNAME, Revenue, EmpCount
Table: view_manpower_cost_Rcpp | D: Productivity: Cost per Person (CPP) vs spend. | C: geography, BillingModel, Amount, EmpCount

[Masters & Dimensions]
Table: master_businessunit | D: Lookup for Business Unit IDs to Name (CSO Towers). | C: bu_no, business_unit
Table: master_revenuecategory | D: Revenue category classification lookup. | C: rc_no, revenue_category
Table: new_customer_master | D: Registry of customer start periods. | C: Customer, Month, FiscalYear
Table: practice_master | D: Internal practice name mapping (In/Out). | C: Practice_in, Practice_out
Table: View_Dim_CustomerGroup | D: Distinct list of Customer Groups. | C: CustomerGroup
Table: View_Dim_FiscalMonth | D: Distinct list of Fiscal Months. | C: FiscalMonth
Table: View_Dim_FiscalYear | D: Distinct list of Fiscal Years. | C: FiscalYear
Table: view_calendar | D: Standard date dimension (Day/Month/Year/Fiscal). | C: Day, Month, FiscalYear
Table: view_calendar_unique | D: Fiscal period list for filters. | C: FiscalMonthYear, FiscalYear
Table: view_del_org | D: Distinct list of Delivery Organizations. | C: DelOrg
Table: view_geo_customer | D: Unique Geo to Customer mapping. | C: Geo, Customer
Table: view_ML_Nature | D: Lookup for cost/revenue 'Nature' item. | C: Nature
Table: view_processdates | D: Logic for Today, Last 6 Months, FY Start. | C: TODAY, Last6Month, FYSTARTMONTH
Table: view_rev_cat | D: Distinct list of revenue categories. | C: Category
Table: view_subgeography | D: Geo to Sub-Geo hierarchy mapping. | C: GEO, SUB_GEOGRAPHY

**Instructions:**
1.  **Analyze the User Query:** Look for keywords related to business concepts (e.g., "Pipeline," "DSO," "Headcount," "Margins," "Targets").
2.  **Match to Schema:** Compare keywords to the Table Descriptions (`D`) and Columns (`C`).
3.  **Prioritize Fact Tables:** Select the table containing the *metrics* requested (e.g., if asking for Revenue, choose `view_accountaggregate` or `view_account_rev` based on context).
4.  **Include Dimension Tables:** If the user asks to filter by a specific attribute (e.g., "by Business Unit" or "by Geo") and that attribute is an ID or requires a join, include the relevant Master/View table.

### IMPORTANT:
        You must return the selection in the following JSON format.
        {format_instructions}

"""

TABLE_DESCRIPTION={
    "account_margins": "Profitability Actual vs Targets per account.",
    "r_marg_proj": "Project revenue/margins. CSO Towers & Managed Services vs Projects split.",
    "view_accountaggregate": "Master KPIs: Top 10, YoY Growth, RPP, CPP, Margins.",
    "view_accountaggregate_revenuesize": "Accounts categorized by USD annual revenue size.",
    "view_account_rev": "Summary of account revenue vs USD plan.",
    "view_marg_cost": "Margin-impacting cost components per project.",
    "view_r_marg_proj": "Projections for project margins and revenue.",
    "view_rev_proj": "Revenue projections + project expiration tracking.",
    "DSO": "Billed/Unbilled DSO metrics by Geo.",
    "ROH_CFO": "Revenue on Hand monthly amounts + CFO comments.",
    "Unbilled_CFO": "Unbilled revenue oversight + remarks.",
    "sundry_debtors": "AR aging report (0-2+ yrs) for invoices.",
    "view_dso_codes": "Geo/CustGroup mapping for DSO amounts.",
    "view_unbilled_DSO": "Global unbilled revenue trend tracking (USD).",
    "account_aggregate_dso": "Account-level revenue for DSO analysis.",
    "view_billing": "List of distinct billing types.",
    "view_opportunities_transformed_practice": "CRM: Win Ratio, Loss Reasons, TCV, ACV.",
    "view_opportunity_pipeline_all": "Funnel view: Stages, Aging, and ACV.",
    "view_pipeline_deals": "Deal counts and pipeline value per segment.",
    "view_pipeline_dealsize": "Pipeline segmentation by deal value buckets.",
    "pm_practice_target": "Planned financial targets (USD Plan).",
    "view_practice_target": "Practice OB and Revenue targets (Multi-currency).",
    "view_cost_center_plan": "Budget/Plan by cost center and nature.",
    "view_cost_plan": "High-level budget by MIS category and group.",
    "manpower_cost": "Labor costs by Team/Billing Model (Cost Centers).",
    "view_fte": "Headcount. Use for Onsite vs Offshore mix impact.",
    "view_fte_RCPP": "Productivity: Revenue per Person (RPP) per account.",
    "view_manpower_cost_Rcpp": "Productivity: Cost per Person (CPP) vs spend.",
    "master_businessunit": "Lookup for Business Unit IDs to Name (CSO Towers).",
    "master_revenuecategory": "Revenue category classification lookup.",
    "new_customer_master": "Registry of customer start periods.",
    "practice_master": "Internal practice name mapping (In/Out).",
    "View_Dim_CustomerGroup": "Distinct list of Customer Groups.",
    "View_Dim_FiscalMonth": "Distinct list of Fiscal Months.",
    "View_Dim_FiscalYear": "Distinct list of Fiscal Years.",
    "view_calendar": "Standard date dimension (Day/Month/Year/Fiscal).",
    "view_calendar_unique": "Fiscal period list for filters.",
    "view_del_org": "Distinct list of Delivery Organizations.",
    "view_geo_customer": "Unique Geo to Customer mapping.",
    "view_ML_Nature": "Lookup for cost/revenue 'Nature' item.",
    "view_processdates": "Logic for Today, Last 6 Months, FY Start.",
    "view_rev_cat": "Distinct list of revenue categories.",
    "view_subgeography": "Geo to Sub-Geo hierarchy mapping."
}