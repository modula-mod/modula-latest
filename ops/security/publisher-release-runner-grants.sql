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
\if :{?publisher_trust_authority_role}
\else
  \echo 'publisher_trust_authority_role is required'
  \quit 2
\endif
\if :{?publisher_trust_authority_account_id}
\else
  \echo 'publisher_trust_authority_account_id is required'
  \quit 2
\endif
\if :{?signing_identity_authority_role}
\else
  \echo 'signing_identity_authority_role is required'
  \quit 2
\endif
\if :{?signing_identity_authority_account_id}
\else
  \echo 'signing_identity_authority_account_id is required'
  \quit 2
\endif
\if :{?quarantine_authority_role}
\else
  \echo 'quarantine_authority_role is required'
  \quit 2
\endif
\if :{?quarantine_authority_account_id}
\else
  \echo 'quarantine_authority_account_id is required'
  \quit 2
\endif
\if :{?revocation_authority_role}
\else
  \echo 'revocation_authority_role is required'
  \quit 2
\endif
\if :{?revocation_authority_account_id}
\else
  \echo 'revocation_authority_account_id is required'
  \quit 2
\endif

BEGIN;

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
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'publisher_trust_authority_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'publisher_trust_authority_role does not exist'
  \quit 3
\endif
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'signing_identity_authority_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'signing_identity_authority_role does not exist'
  \quit 3
\endif
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'quarantine_authority_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'quarantine_authority_role does not exist'
  \quit 3
\endif
SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'revocation_authority_role') AS role_exists \gset
\if :role_exists
\else
  \echo 'revocation_authority_role does not exist'
  \quit 3
\endif

SELECT COUNT(DISTINCT role_name) = 8 AS roles_are_distinct
FROM (VALUES
  (:'runner_role'),
  (:'approver_role'),
  (:'trust_verifier_role'),
  (:'publication_authority_role'),
  (:'publisher_trust_authority_role'),
  (:'signing_identity_authority_role'),
  (:'quarantine_authority_role'),
  (:'revocation_authority_role')
) AS roles(role_name) \gset
\if :roles_are_distinct
\else
  \echo 'all eight signing and governance boundary roles must be distinct'
  \quit 4
\endif

SELECT NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles
  WHERE rolname IN (
    :'runner_role', :'approver_role', :'trust_verifier_role', :'publication_authority_role'
    , :'publisher_trust_authority_role', :'signing_identity_authority_role', :'quarantine_authority_role'
    , :'revocation_authority_role'
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
SELECT EXISTS (SELECT 1 FROM greenfield_accounts WHERE account_id = :'publisher_trust_authority_account_id') AS actor_exists \gset
\if :actor_exists
\else
  \echo 'publisher_trust_authority_account_id does not identify an existing account'
  \quit 6
\endif
SELECT EXISTS (SELECT 1 FROM greenfield_accounts WHERE account_id = :'signing_identity_authority_account_id') AS actor_exists \gset
\if :actor_exists
\else
  \echo 'signing_identity_authority_account_id does not identify an existing account'
  \quit 6
\endif
SELECT EXISTS (SELECT 1 FROM greenfield_accounts WHERE account_id = :'quarantine_authority_account_id') AS actor_exists \gset
\if :actor_exists
\else
  \echo 'quarantine_authority_account_id does not identify an existing account'
  \quit 6
\endif
SELECT EXISTS (SELECT 1 FROM greenfield_accounts WHERE account_id = :'revocation_authority_account_id') AS actor_exists \gset
\if :actor_exists
\else
  \echo 'revocation_authority_account_id does not identify an existing account'
  \quit 6
\endif

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"runner_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"runner_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"runner_role";
REVOKE CREATE ON SCHEMA public FROM :"runner_role";
GRANT USAGE ON SCHEMA public TO :"runner_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_runner_claim(TEXT, INTEGER) TO :"runner_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_runner_submit_signature(TEXT, TEXT, TEXT, TEXT) TO :"runner_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_runner_fail(TEXT, TEXT) TO :"runner_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"approver_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"approver_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"approver_role";
REVOKE CREATE ON SCHEMA public FROM :"approver_role";
GRANT USAGE ON SCHEMA public TO :"approver_role";
GRANT EXECUTE ON FUNCTION greenfield_release_approver_record(TEXT, TEXT) TO :"approver_role";
GRANT EXECUTE ON FUNCTION greenfield_release_approver_invalidate(TEXT, TEXT) TO :"approver_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"trust_verifier_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"trust_verifier_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"trust_verifier_role";
REVOKE CREATE ON SCHEMA public FROM :"trust_verifier_role";
GRANT USAGE ON SCHEMA public TO :"trust_verifier_role";
GRANT EXECUTE ON FUNCTION greenfield_trust_verifier_claim(TEXT)
  TO :"trust_verifier_role";
GRANT EXECUTE ON FUNCTION greenfield_trust_verifier_record(TEXT, TEXT, BOOLEAN, TEXT, TEXT)
  TO :"trust_verifier_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"publication_authority_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"publication_authority_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"publication_authority_role";
REVOKE CREATE ON SCHEMA public FROM :"publication_authority_role";
GRANT USAGE ON SCHEMA public TO :"publication_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_publication_authority_publish_next()
  TO :"publication_authority_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"publisher_trust_authority_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"publisher_trust_authority_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"publisher_trust_authority_role";
REVOKE CREATE ON SCHEMA public FROM :"publisher_trust_authority_role";
GRANT USAGE ON SCHEMA public TO :"publisher_trust_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_publisher_trust_authority_set(TEXT, TEXT, TEXT, TEXT)
  TO :"publisher_trust_authority_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"signing_identity_authority_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"signing_identity_authority_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"signing_identity_authority_role";
REVOKE CREATE ON SCHEMA public FROM :"signing_identity_authority_role";
GRANT USAGE ON SCHEMA public TO :"signing_identity_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_identity_authority_register(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO :"signing_identity_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_identity_authority_rotate(
  TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO :"signing_identity_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_signing_identity_authority_revoke(TEXT, TEXT)
  TO :"signing_identity_authority_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"quarantine_authority_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"quarantine_authority_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"quarantine_authority_role";
REVOKE CREATE ON SCHEMA public FROM :"quarantine_authority_role";
GRANT USAGE ON SCHEMA public TO :"quarantine_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_quarantine_authority_record(TEXT, TEXT, TEXT)
  TO :"quarantine_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_quarantine_authority_lift(TEXT, TEXT)
  TO :"quarantine_authority_role";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"revocation_authority_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"revocation_authority_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM :"revocation_authority_role";
REVOKE CREATE ON SCHEMA public FROM :"revocation_authority_role";
GRANT USAGE ON SCHEMA public TO :"revocation_authority_role";
GRANT EXECUTE ON FUNCTION greenfield_revocation_authority_record(TEXT, TEXT, TEXT, TEXT)
  TO :"revocation_authority_role";

-- The actual login role (session_user), not SET ROLE/current_user or a caller
-- parameter, is bound to each authority. These rows are never visible to the
-- boundary roles and cannot be created or changed by them.
INSERT INTO greenfield_publisher_release_authority_principals (
  database_role, authority, account_id, active, granted_at, revoked_at
) VALUES
  (:'runner_role', 'SIGNING_RUNNER', NULL, TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'approver_role', 'RELEASE_APPROVER', :'approver_account_id', TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'trust_verifier_role', 'TRUST_VERIFIER', NULL, TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'publication_authority_role', 'PUBLICATION_AUTHORITY', :'publication_authority_account_id', TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'publisher_trust_authority_role', 'PUBLISHER_TRUST_AUTHORITY', :'publisher_trust_authority_account_id', TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'signing_identity_authority_role', 'SIGNING_IDENTITY_AUTHORITY', :'signing_identity_authority_account_id', TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'quarantine_authority_role', 'QUARANTINE_AUTHORITY', :'quarantine_authority_account_id', TRUE, pg_catalog.clock_timestamp(), NULL),
  (:'revocation_authority_role', 'REVOCATION_AUTHORITY', :'revocation_authority_account_id', TRUE, pg_catalog.clock_timestamp(), NULL)
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"approver_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"approver_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"trust_verifier_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"trust_verifier_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"trust_verifier_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"publication_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"publication_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"publication_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"publisher_trust_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"publisher_trust_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"publisher_trust_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"signing_identity_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"signing_identity_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"signing_identity_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"quarantine_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"quarantine_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"quarantine_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"revocation_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM :"revocation_authority_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM :"revocation_authority_role";

SELECT greenfield_assert_publisher_authority_role_isolation(
  :'runner_role'::NAME,
  :'approver_role'::NAME,
  :'trust_verifier_role'::NAME,
  :'publication_authority_role'::NAME,
  :'publisher_trust_authority_role'::NAME,
  :'signing_identity_authority_role'::NAME,
  :'quarantine_authority_role'::NAME,
  :'revocation_authority_role'::NAME
);

COMMIT;
