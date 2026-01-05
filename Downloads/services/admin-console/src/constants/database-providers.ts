import { DatabaseDialect, EDatabaseDialect } from '@/models/api'
import { STATIC_COPILOT_URL } from '@/config'

export interface DatabaseProvider {
  name: string
  driver: string
  dialect: DatabaseDialect
  logoUrl: string
}

const DATABASE_PROVIDERS: DatabaseProvider[] = [
  {
    name: 'PostgreSQL',
    driver: 'postgresql+psycopg2',
    dialect: EDatabaseDialect.postgresql,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/postgresql.svg`,
  },
  {
    name: 'MS SQL Server',
    driver: 'mssql+pymssql',
    dialect: EDatabaseDialect.mssql,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/sql-server.png`,
  },
  {
    name: 'Databricks',
    driver: 'databricks',
    dialect: EDatabaseDialect.databricks,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/databricks.svg`,
  },
  {
    name: 'Snowflake',
    driver: 'snowflake',
    dialect: EDatabaseDialect.snowflake,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/snowflake.svg`,
  },
  {
    name: 'Redshift',
    driver: 'redshift+psycopg2',
    dialect: EDatabaseDialect.redshift,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/redshift.png`,
  },
  {
    name: 'BigQuery',
    driver: 'bigquery',
    dialect: EDatabaseDialect.bigquery,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/bigquery.svg`,
  },
  {
    name: 'AWS Athena',
    driver: 'awsathena+rest',
    dialect: EDatabaseDialect.awsathena,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/aws-athena.svg`,
  },
  {
    name: 'MariaDB',
    driver: 'mysql+pymysql',
    dialect: EDatabaseDialect.mysql,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/mariadb.svg`,
  },
  {
    name: 'ClickHouse',
    driver: 'clickhouse+http',
    dialect: EDatabaseDialect.clickhouse,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/clickhouse.svg`,
  },
]

export default DATABASE_PROVIDERS
