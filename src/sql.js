export const SQL_SECTIONS = {
  TABLE: {
    label: "Tables", icon: "⬡", description: "Table list + RLS enabled/forced",
    sql: `tables AS (
  SELECT 'TABLE' AS section, t.table_schema AS schema, t.table_name AS name, NULL AS sub_name,
    json_build_object('row_security',c.relrowsecurity,'force_rls',c.relforcerowsecurity)::text AS detail
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname=t.table_name
  JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.table_schema
  WHERE t.table_schema NOT IN ('pg_catalog','information_schema','pg_toast') AND t.table_type='BASE TABLE'
)`
  },
  COLUMN: {
    label: "Columns", icon: "≡", description: "Column types, nullability, defaults",
    sql: `columns AS (
  SELECT 'COLUMN' AS section, table_schema AS schema, table_name AS name, column_name AS sub_name,
    json_build_object('ordinal',ordinal_position,'type',udt_name,'nullable',is_nullable,'default',column_default)::text AS detail
  FROM information_schema.columns
  WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
)`
  },
  RLS_POLICY: {
    label: "RLS Policies", icon: "⚿", description: "Row level security rules and roles",
    sql: `rls AS (
  SELECT 'RLS_POLICY' AS section, n.nspname AS schema, c.relname AS name, p.policyname AS sub_name,
    json_build_object('cmd',p.cmd,'roles',p.roles,'qual',p.qual,'with_check',p.with_check)::text AS detail
  FROM pg_policies p
  JOIN pg_class c ON c.relname=p.tablename
  JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=p.schemaname
  WHERE p.schemaname NOT IN ('pg_catalog','information_schema')
)`
  },
  TRIGGER: {
    label: "Triggers", icon: "⚡", description: "Trigger events, timing, statements",
    sql: `triggers AS (
  SELECT 'TRIGGER' AS section, trigger_schema AS schema, event_object_table AS name, trigger_name AS sub_name,
    json_build_object('event',event_manipulation,'timing',action_timing,'orientation',action_orientation,'statement',action_statement)::text AS detail
  FROM information_schema.triggers
  WHERE trigger_schema NOT IN ('pg_catalog','information_schema')
)`
  },
  FUNCTION: {
    label: "Functions", icon: "ƒ", description: "Full function definitions and signatures",
    sql: `functions AS (
  SELECT 'FUNCTION' AS section, n.nspname AS schema, p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS sub_name,
    json_build_object('language',l.lanname,'security',CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END,'returns',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid))::text AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang
  WHERE n.nspname IN ('public','extensions') AND p.prokind='f' AND l.lanname NOT IN ('c','internal')
)`
  },
  INDEX: {
    label: "Indexes", icon: "⌖", description: "Custom indexes and uniqueness",
    sql: `indexes AS (
  SELECT 'INDEX' AS section, n.nspname AS schema, t.relname AS name, i.relname AS sub_name,
    json_build_object('unique',ix.indisunique,'primary',ix.indisprimary,'definition',pg_get_indexdef(ix.indexrelid))::text AS detail
  FROM pg_index ix
  JOIN pg_class i ON i.oid=ix.indexrelid
  JOIN pg_class t ON t.oid=ix.indrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public' AND NOT ix.indisprimary
)`
  },
  ENUM: {
    label: "Enums", icon: "≣", description: "Custom enum types and values",
    sql: `enums AS (
  SELECT 'ENUM' AS section, n.nspname AS schema, t.typname AS name, e.enumlabel AS sub_name,
    json_build_object('sort_order',e.enumsortorder)::text AS detail
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid=t.oid
  JOIN pg_namespace n ON n.oid=t.typnamespace
  WHERE n.nspname='public'
)`
  },
  FOREIGN_KEY: {
    label: "Foreign Keys", icon: "⇔", description: "Table relationships and cascade rules",
    sql: `foreign_keys AS (
  SELECT 'FOREIGN_KEY' AS section, n.nspname AS schema, c.conname AS name, tc.relname AS sub_name,
    json_build_object('table',tc.relname,'column',kcu.column_name,'ref_table',ccu.table_name,'ref_column',ccu.column_name,'on_delete',rc.delete_rule,'on_update',rc.update_rule)::text AS detail
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid=c.connamespace
  JOIN pg_class tc ON tc.oid=c.conrelid
  JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=c.conname AND kcu.constraint_schema=n.nspname
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=c.conname AND ccu.constraint_schema=n.nspname
  JOIN information_schema.referential_constraints rc ON rc.constraint_name=c.conname AND rc.constraint_schema=n.nspname
  WHERE c.contype='f' AND n.nspname='public'
)`
  },
  CHECK_CONSTRAINT: {
    label: "Check Constraints", icon: "✓", description: "Column validation rules",
    sql: `check_constraints AS (
  SELECT 'CHECK_CONSTRAINT' AS section, n.nspname AS schema, tc.relname AS name, c.conname AS sub_name,
    json_build_object('definition',pg_get_constraintdef(c.oid))::text AS detail
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid=c.connamespace
  JOIN pg_class tc ON tc.oid=c.conrelid
  WHERE c.contype='c' AND n.nspname='public'
)`
  },
  SEQUENCE: {
    label: "Sequences", icon: "#", description: "Auto-increment sequences",
    sql: `sequences AS (
  SELECT 'SEQUENCE' AS section, sequence_schema AS schema, sequence_name AS name, NULL AS sub_name,
    json_build_object('data_type',data_type,'start',start_value,'increment',increment,'min',minimum_value,'max',maximum_value,'cycle',cycle_option)::text AS detail
  FROM information_schema.sequences WHERE sequence_schema='public'
)`
  },
  EXTENSION: {
    label: "Extensions", icon: "⊕", description: "Installed Postgres extensions",
    sql: `extensions AS (
  SELECT 'EXTENSION' AS section, 'extensions' AS schema, extname AS name, NULL AS sub_name,
    json_build_object('version',extversion,'schema',n.nspname)::text AS detail
  FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
)`
  },
  BUCKET: {
    label: "Buckets", icon: "◉", description: "Storage buckets and settings",
    sql: `buckets AS (
  SELECT 'BUCKET' AS section, 'storage' AS schema, name AS name, id AS sub_name,
    json_build_object('public',public,'file_size_limit',file_size_limit,'allowed_mimes',allowed_mime_types)::text AS detail
  FROM storage.buckets
)`
  },
  BUCKET_RLS: {
    label: "Bucket RLS", icon: "⚿", description: "Storage object access policies",
    sql: `bucket_rls AS (
  SELECT 'BUCKET_RLS' AS section, n.nspname AS schema, c.relname AS name, p.policyname AS sub_name,
    json_build_object('cmd',p.cmd,'roles',p.roles,'qual',p.qual,'with_check',p.with_check)::text AS detail
  FROM pg_policies p
  JOIN pg_class c ON c.relname=p.tablename
  JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=p.schemaname
  WHERE p.schemaname='storage' AND p.tablename='objects'
)`
  },
  REALTIME: {
    label: "Realtime", icon: "⟳", description: "Tables with Realtime publication enabled",
    sql: `realtime AS (
  SELECT 'REALTIME' AS section, pt.schemaname AS schema, pt.tablename AS name, NULL AS sub_name,
    json_build_object('publication',pt.pubname,'schema',pt.schemaname)::text AS detail
  FROM pg_publication_tables pt
  WHERE pt.pubname = 'supabase_realtime'
)`
  }
};

export const ALL_SECTIONS = [
  "TABLE","COLUMN","RLS_POLICY","TRIGGER","FUNCTION",
  "INDEX","ENUM","FOREIGN_KEY","CHECK_CONSTRAINT","SEQUENCE",
  "EXTENSION","BUCKET","BUCKET_RLS","REALTIME"
];

const CTE_ALIASES = {
  TABLE:'tables', COLUMN:'columns', RLS_POLICY:'rls', TRIGGER:'triggers',
  FUNCTION:'functions', INDEX:'indexes', ENUM:'enums', FOREIGN_KEY:'foreign_keys',
  CHECK_CONSTRAINT:'check_constraints', SEQUENCE:'sequences', EXTENSION:'extensions',
  BUCKET:'buckets', BUCKET_RLS:'bucket_rls', REALTIME:'realtime'
};

export function buildSQL(selectedSections) {
  if (!selectedSections || selectedSections.length === 0) return "";
  const ctes = selectedSections.map(s => SQL_SECTIONS[s]?.sql).filter(Boolean);
  const selects = selectedSections.map(s => `SELECT section, schema, name, sub_name, detail FROM ${CTE_ALIASES[s]}`);
  return `-- ================================================================
-- DRIFTWATCH SCHEMA SNAPSHOT
-- ⚠ Set row limit to "No limit" in SQL editor bottom bar first!
-- ================================================================
WITH
${ctes.join(',\n')}
${selects.join('\nUNION ALL\n')}
ORDER BY section, schema, name, sub_name;`;
}