"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { addConnectDatabases } from "@/lib/api";
import { useSession } from "next-auth/react";
import "../../app/globals.css";
import { cn } from "@/lib/utils";

const STATIC_COPILOT_URL = process.env.NEXT_PUBLIC_BASE_PATH;

enum EDatabaseDialect {
  postgresql = "postgresql",
  mysql = "mysql",
  mssql = "mssql",
  databricks = "databricks",
  snowflake = "snowflake",
  redshift = "redshift",
  clickhouse = "clickhouse",
  awsathena = "awsathena",
  duckdb = "duckdb",
  bigquery = "bigquery",
  sqlite = "sqlite",
  aurora = "aurora",
}

type DatabaseDialect = keyof typeof EDatabaseDialect;

// Interface for database provider details
export interface DatabaseProvider {
  name: string;
  driver: string;
  dialect: DatabaseDialect;
  logoUrl: string;
}

// List of supported database providers with their details
const DATABASE_PROVIDERS: DatabaseProvider[] = [
  {
    name: "PostgreSQL",
    driver: "postgresql+psycopg2",
    dialect: EDatabaseDialect.postgresql,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/postgresql.svg`,
  },
  {
    name: "MS SQL Server",
    driver: "mssql+pymssql",
    dialect: EDatabaseDialect.mssql,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/sql-server.png`,
  },
  {
    name: "Databricks",
    driver: "databricks",
    dialect: EDatabaseDialect.databricks,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/databricks.svg`,
  },
  {
    name: "Snowflake",
    driver: "snowflake",
    dialect: EDatabaseDialect.snowflake,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/snowflake.svg`,
  },
  {
    name: "Redshift",
    driver: "redshift+psycopg2",
    dialect: EDatabaseDialect.redshift,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/redshift.png`,
  },
  {
    name: "BigQuery",
    driver: "bigquery",
    dialect: EDatabaseDialect.bigquery,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/bigquery.svg`,
  },
  {
    name: "AWS Athena",
    driver: "awsathena+rest",
    dialect: EDatabaseDialect.awsathena,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/aws-athena.svg`,
  },
  {
    name: "MariaDB",
    driver: "mysql+pymysql",
    dialect: EDatabaseDialect.mysql,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/mariadb.svg`,
  },
  {
    name: "ClickHouse",
    driver: "clickhouse+http",
    dialect: EDatabaseDialect.clickhouse,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/clickhouse.svg`,
  },
  {
    name: "DuckDB",
    driver: "duckdb",
    dialect: EDatabaseDialect.duckdb,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/duckdb.svg`,
  },
  {
    name: "SQLite",
    driver: "sqlite",
    dialect: EDatabaseDialect.sqlite,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/sqlite.svg`,
  },
  // Aurora (Postgres-compatible) — use same driver as Postgres for URI builder,
  // but dialect is 'aurora' so backend can record it.
  {
    name: "AWS Aurora",
    driver: "postgresql+psycopg2",
    dialect: EDatabaseDialect.aurora,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/aws-aurora.svg`,
  },
  // AWS Aurora (MySQL) - MySQL-compatible flavor
  {
    name: "AWS Aurora (MySQL)",
    driver: "mysql+pymysql",
    dialect: EDatabaseDialect.aurora,
    logoUrl: `${STATIC_COPILOT_URL}/images/databases/aws-aurora.svg`,
  },
];

// Interface for form values
interface FormValues {
  databaseProvider: string;
  alias: string;
  connectionUri: string;
  useSSH: boolean;
  schemas: string[];
  username?: string; // new
  password?: string; // new
  host?: string;     // new
  port?: string;     // new
  database?: string; // new
}

// Props for the AddDatabaseComponent
interface AddDatabaseComponentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Component to add a new database connection
export function AddDatabaseComponent({
  open,
  onOpenChange,
  onSuccess,
}: AddDatabaseComponentProps) {
  const [schemas, setSchemas] = useState<string[]>([]);
  const [currentSchema, setCurrentSchema] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [useUriBuilder, setUseUriBuilder] = useState(false);
  const { data: session, status } = useSession();

  // Initialize form with default values
  const form = useForm<FormValues>({
    defaultValues: {
      databaseProvider: "postgresql+psycopg2",
      alias: "",
      connectionUri: "",
      useSSH: false,
      schemas: [],
    },
  });

  const selectedProvider = DATABASE_PROVIDERS.find(
    (provider) => provider.driver === form.watch("databaseProvider")
  );

  // Handle adding a schema
  const handleAddSchema = () => {
    if (currentSchema.trim() && !schemas.includes(currentSchema.trim())) {
      setSchemas([...schemas, currentSchema.trim()]);
      setCurrentSchema("");
    }
  };

  // Handle removing a schema
  const handleRemoveSchema = (schema: string) => {
    setSchemas(schemas.filter((s) => s !== schema));
  };

  // Handle key down event for adding schema on Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSchema();
    }
  };

  // Helper to build the URI
  useEffect(() => {
    if (useUriBuilder) {
      const provider = form.watch("databaseProvider") || "postgresql+psycopg2";
      const username = encodeURIComponent(form.watch("username") || "");
      const password = encodeURIComponent(form.watch("password") || "");
      const host = form.watch("host") || "";
      const port = form.watch("port") || "";
      const database = form.watch("database") || "";
      if (username && password && host && database) {
        const uri = `${provider}://${username}:${password}@${host}${port ? `:${port}` : ""}/${database}`;
        form.setValue("connectionUri", uri);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.watch("databaseProvider"),
    form.watch("username"),
    form.watch("password"),
    form.watch("host"),
    form.watch("port"),
    form.watch("database"),
    useUriBuilder,
  ]);

  // Submit handler for the form
  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);

    try {
      const formData = new FormData();

      const requestJson = {
        alias: data.alias,
        use_ssh: data.useSSH,
        connection_uri: data.connectionUri,
        schemas: schemas,
      };

      formData.append("request_json", JSON.stringify(requestJson));
      formData.append("file", ""); // Empty file field by Default

      const response = await addConnectDatabases(
        (session as any)?.user?.accessToken,
        formData
      );

      if (response) {
        onOpenChange(false);
        if (typeof onSuccess === "function") {
          onSuccess();
        }
      } else {
        console.error("Failed to add database");
      }
    } catch (error) {
      console.error("Error adding database:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md md:max-w-xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Add Database</DialogTitle>
          <p className="text-sm text-gray-500">
            Connect database to the platform.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {/* Database Provider */}
              <div>
                <h3 className="text-sm font-medium mb-2">Data warehouse</h3>
                <FormField
                  control={form.control}
                  name="databaseProvider"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select database provider">
                              {selectedProvider && (
                                <div className="flex items-center">
                                  <div className="w-6 h-6 mr-2 relative">
                                    <Image
                                      src={selectedProvider.logoUrl}
                                      alt={selectedProvider.name}
                                      width={24}
                                      height={24}
                                    />
                                  </div>
                                  {selectedProvider.name}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DATABASE_PROVIDERS.map((provider) => (
                            <SelectItem
                              key={provider.driver}
                              value={provider.driver}
                            >
                              <div className="flex items-center">
                                <div className="w-6 h-6 mr-2 relative">
                                  <Image
                                    src={provider.logoUrl}
                                    alt={provider.name}
                                    width={24}
                                    height={24}
                                  />
                                </div>
                                {provider.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              {/* Alias */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="alias"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Alias
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Type an alias for the database"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Toggle for URI builder */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useUriBuilder}
                  onChange={() => setUseUriBuilder((v) => !v)}
                  id="uri-builder-toggle"
                />
                <label htmlFor="uri-builder-toggle" className="text-sm">
                  Use URI Builder (auto-encode credentials)
                </label>
              </div>

              {useUriBuilder && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Username"
                    value={form.watch("username") || ""}
                    onChange={(e) => form.setValue("username", e.target.value)}
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    value={form.watch("password") || ""}
                    onChange={(e) => form.setValue("password", e.target.value)}
                  />
                  <Input
                    placeholder="Host"
                    value={form.watch("host") || ""}
                    onChange={(e) => form.setValue("host", e.target.value)}
                  />
                  <Input
                    placeholder="Port (optional)"
                    value={form.watch("port") || ""}
                    onChange={(e) => form.setValue("port", e.target.value)}
                  />
                  <Input
                    placeholder="Database"
                    value={form.watch("database") || ""}
                    onChange={(e) => form.setValue("database", e.target.value)}
                  />
                </div>
              )}

              {/* Connection URI */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="connectionUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Connection URI
                      </FormLabel>
                      <div className="flex items-center">
                        <div className="bg-gray-100 p-2 text-xs text-gray-500 border border-r-0 rounded-l-md">
                          {selectedProvider?.driver ||
                            "jdbc:postgresql+psycopg2://"}
                        </div>
                        <FormControl>
                          <Input
                            className="rounded-l-none"
                            placeholder="Connection URI"
                            {...field}
                            readOnly={useUriBuilder}
                          />
                        </FormControl>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {useUriBuilder
                          ? "Credentials will be percent-encoded automatically."
                          : "If your username or password contains special characters (like @, !, :, /), please percent-encode them (e.g., @ → %40, ! → %21)."}
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Schema Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Schemas</label>
                  <span className="text-xs text-gray-500">
                    Press Enter to add a schema
                  </span>
                </div>
                <div className="flex">
                  <Input
                    placeholder="Enter the schemas you want to connect to"
                    value={currentSchema}
                    onChange={(e) => setCurrentSchema(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                  />
                </div>

                {schemas.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {schemas.map((schema) => (
                      <div
                        key={schema}
                        className="bg-gray-100 px-2 py-1 rounded-md flex items-center text-sm"
                      >
                        {schema}
                        <button
                          type="button"
                          onClick={() => handleRemoveSchema(schema)}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                className={cn(
                  "transition-all group",
                  "text-[var(--color-text-dark)]",
                  "hover:text-[var(--color-text-highlight)]",
                  "hover:bg-[var(--color-button-highlight)]",
                )}
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Add Database"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddDatabaseComponent;
