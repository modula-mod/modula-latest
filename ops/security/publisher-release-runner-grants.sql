\set ON_ERROR_STOP on

\if :{?runner_role}
\else
  \echo 'runner_role is required'
  \quit 2
\endif
\if :{?approver_role}
\else
  \echo 'approver_role is required'
  \quit 2
\endif
\if :{?approver_account_id}
\else
  \echo 'approver_account_id is required'
  \quit 2
\endif
\if :{?trust_verifier_role}
\else
  \echo 'trust_verifier_role is required'
  \quit 2
\endif
\if :{?publication_authority_role}
\else
  \echo 'publication_authority_role is required'
  \quit 2
\endif
\if :{?publication_authority_account_id}
\else
  \echo 'publication_authority_account_id is required'
  \quit 2
\endif

-- Environment owners provision these login roles and their credentials. This
-- script only removes ambient authority and installs the fixed boundaries.
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'runner_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'runner_role does not exist'
  \quit 3
\endif
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'approver_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'approver_role does not exist'
  \quit 3
\endif
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'trust_verifier_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'trust_verifier_role does not exist'
  \quit 3
\endif
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'publication_authority_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'publication_authority_role does not exist'
  \quit 3
\endif

SELECT COUNT(DISTINCT role_name) = 4 AS roles_are_distinct
FROM (VALUES
  (:'runner_role'),
  (:'approver_role'),
  (:'trust_verifier_role'),
  (:'publication_authority_role')
) AS roles(role_name) \gset
\if :roles_are_distinct
\else
  \echo 'runner, approver, trust verifier and publication authority roles must be distinct'
  \quit 4
\endif

SELECT NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles
  WHERE rolname IN (
    :'runner_role', :'approver_role', :'trust_verifier_role', :'publication_authority_role'
  ) AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)
) AS roles_are_restricted \gset
\if :roles_are_restricted
\else
  \echo 'boundary roles must not be superuser, role creator, database creator, replication or BYPASSRLS roles'
  \quit 5
\endif

SELECT EXISTS (SELECT 1 FROM greenfield_accounts WHERE account_id = :'approver_account_id') AS actor_exists \gset
\if :actor_exists
\else
  \echo 'approver_account_id does not identify an existing account'
  \quit 6
\endif
SELECT EXISTS (SELECT 1 FROM greenfield_accounts WHERE account_id = :'publication_authority_account_id') AS actor_exists \gset
\if :actor_exists
\else
  \echo 'publication_authority_account_id does not identify an existing account'
  \quit 6
\endif

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"runner_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"runner_role";
REVOKE CREATE ON SCHEMA public FROM :"runner_role";
GRANT USAGE ON SCHEMA public TO :"runner_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_runner_claim(TEXT, INTEGER) TO :"runner_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_runner_submit_signature(TEXT, TEXT, TEXT, TEXT) TO :"runner_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_runner_fail(TEXT, TEXT) TO :"runner_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"approver_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"approver_role";
REVOKE CREATE ON SCHEMA public FROM :"approver_role";
GRANT USAGE ON SCHEMA public TO :"approver_role";
GRANT EXECUTE ON FUNCTION greenfield_release_approver_record(TEXT, TEXT) TO :"approver_role";
GRANT EXECUTE ON FUNCTION greenfield_release_approver_invalidate(TEXT, TEXT) TO :"approver_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"trust_verifier_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"trust_verifier_role";
REVOKE CREATE ON SCHEMA public FROM :"trust_verifier_role";
GRANT USAGE ON SCHEMA public TO :"trust_verifier_role";
GRANT EXECUTE ON FUNCTION greenfield_trust_verifier_claim(TEXT)
  TO :"trust_verifier_role";
GRANT EXECUTE ON FUNCTION greenfield_trust_verifier_record(TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  TO :"trust_verifier_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"publication_authority_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"publication_authority_role";
REVOKE CREATE ON SCHEMA public FROM :"publication_authority_role";
GRANT USAGE ON SCHEMA public TO :"publication_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_publication_authority_publish_next()
  TO :"publication_authority_role";

-- The actual login role (session_user), not SET ROLE/current_user or a caller
-- parameter, is bound to each authority. These rows are never visible to the
-- boundary roles and cannot be created or changed by them.
INSERT INTO greenfield_publisher_release_authority_principals (
  database_role, authority, account_id, active, granted_at, revoked_at
) VALUES
  (:'runner_role', 'SIGNING_RUNNER', NULL, TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'approver_role', 'RELEASE_APPROVER', :'approver_account_id', TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'trust_verifier_role', 'TRUST_VERIFIER', NULL, TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'publication_authority_role', 'PUBLICATION_AUTHORITY', :'publication_authority_account_id', TRUE, pg_catalog.clock_timestamp(), NULL)
ON CONFLICT (database_role, authority) DO UPDATE
SET account_id = EXCLUDED.account_id,
    active = TRUE,
    granted_at = pg_catalog.clock_timestamp(),
    revoked_at = NULL;

-- Future objects created by the applying owner do not silently broaden any
-- boundary login. Migration 092 explicitly grants only its fixed functions.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"runner_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"runner_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"runner_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"approver_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"trust_verifier_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"publication_authority_role";
