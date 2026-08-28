#!/usr/bin/env node
import {randomBytes} from 'node:crypto'
import {existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
const root=process.cwd(),tool=join(root,'ops/backup/greenfield-backend-v1-recovery.mjs'),failures=[]
function record(label,ok,detail=''){console.log(`${label.padEnd(49)} ${ok?'PASS':'FAIL'}${detail?`  ${detail}`:''}`);if(!ok)failures.push(`${label}: ${detail}`)}
function source(label,file,required,forbidden=[]){const body=existsSync(join(root,file))?readFileSync(join(root,file),'utf8'):'';record(label,Boolean(body)&&required.every(value=>body.includes(value))&&forbidden.every(value=>!body.includes(value)),file)}
function run(label,command,args,cwd=root,env=process.env){console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`);const result=spawnSync(command,args,{cwd,env,stdio:'inherit',shell:false});record(label,result.status===0,cwd);return result.status===0}
function capture(command,args,cwd=root,env=process.env){return spawnSync(command,args,{cwd,env,encoding:'utf8',shell:false})}
function output(command,args){const result=capture(command,args);return result.status===0?result.stdout.trim():''}
console.log('MODULA\nGREENFIELD BACKEND V1\nBACKUP AND RESTORE VERIFIER\n')
source('ENCRYPTED MULTI-DOMAIN BACKUP','ops/backup/greenfield-backend-v1-recovery.mjs',['pg_dump','custom-acl-preserving','MODULA_RECOVERY_AGE_RECIPIENT','MODULE_DATABASE','MANAGED_ASSETS'])
source('SIGNED BACKUP MANIFEST','ops/backup/greenfield-backend-v1-recovery.mjs',['HMAC-SHA256','timingSafeEqual','payload checksum mismatch'])
source('SAFE ORDERED RESTORE','ops/backup/greenfield-backend-v1-recovery.mjs',['--single-transaction','validateArchiveListing','restoreOrder','restore target must be empty'],['--no-owner','--no-acl'])
source('MANAGED DATABASE COVERAGE','ops/backup/greenfield-backend-v1-recovery.mjs',['validateManagedCoverage','managed module database coverage missing','greenfield_data_backup_policies'])
source('NO CREDENTIALS IN MANIFEST TEMPLATE','ops/backup/greenfield-backend-v1-recovery.example.json',['urlEnv','resourceIds'],['postgresql://','password','secret://'])
run('RECOVERY TOOL SYNTAX','node',['--check',tool])
await recoveryExercise()
console.log('\nRESULT');if(failures.length){console.log(`GREENFIELD BACKEND V1 RECOVERY FAIL (${failures.length})`);failures.forEach(value=>console.log(`- ${value}`));process.exit(1)}console.log('GREENFIELD BACKEND V1 RECOVERY PASS')

async function recoveryExercise(){
  const container='modula-preview-greenfield-postgres-1';if(!output('docker',['container','inspect',container])){record('RECOVERY TEST POSTGRES AVAILABLE',false,'preview Postgres unavailable');return}
  const dockerEnv=output('docker',['inspect',container,'--format','{{range .Config.Env}}{{println .}}{{end}}']),values=Object.fromEntries(dockerEnv.split('\n').map(line=>line.split(/=(.*)/s).slice(0,2)).filter(value=>value.length===2))
  const suffix=`${process.pid}_${Date.now()}`.toLowerCase(),role=`gbv1_recovery_${suffix}`,password=randomBytes(24).toString('base64url'),sourceCore=`modula_gbv1_recovery_source_${suffix}`,sourceModule=`modula_gbv1_module_source_${suffix}`,restoreCore=`modula_gbv1_recovery_restore_${suffix}`,restoreModule=`modula_gbv1_module_restore_${suffix}`,scratch=mkdtempSync(join(tmpdir(),'modula-gbv1-recovery-'))
  const databases=[sourceCore,sourceModule,restoreCore,restoreModule]
  try{
    if(!dockerSql(`CREATE ROLE ${role} LOGIN SUPERUSER PASSWORD '${password}'`)){record('RECOVERY TEST ROLE CREATED',false);return}record('RECOVERY TEST ROLE CREATED',true,role)
    for(const [database,owner] of [[sourceCore,'modula_migrator'],[sourceModule,role],[restoreCore,'modula_migrator'],[restoreModule,role]])if(spawnSync('docker',['exec',container,'createdb','-U','modula_admin','-O',owner,database],{stdio:'ignore'}).status!==0)throw new Error(`cannot create ${database}`)
    record('ISOLATED SOURCE AND RESTORE DBS',true,databases.join(','))
    const sourceCoreUrl=dbUrl(role,password,sourceCore),sourceModuleUrl=dbUrl(role,password,sourceModule),restoreCoreUrl=dbUrl(role,password,restoreCore),restoreModuleUrl=dbUrl(role,password,restoreModule)
    const testEnv={...process.env,CI:'true',NODE_ENV:'test',MODULA_TEST_DATABASE_URL:sourceCoreUrl}
    run('SOURCE FULL MIGRATION THROUGH 053','pnpm',['--filter','@modula/greenfield-api','exec','tsx','-e',"import {migrateUp} from './src/database/migrate.ts'; void migrateUp(process.env.MODULA_TEST_DATABASE_URL).then(applied=>{if(!applied.includes('053_greenfield_backend_v1_backup_acl_reconciliation'))process.exit(1)})"],join(root,'services/greenfield-api'),testEnv)
    run('SOURCE RECOVERY DATA JOURNEY','pnpm',['--filter','@modula/greenfield-api','exec','vitest','run','tests/greenfield-backend-v1.account-data.test.ts'],root,testEnv)
    const resourceId=psqlValue(sourceCoreUrl,"SELECT resource_id FROM greenfield_data_resources WHERE primary_storage_mode='dedicated-postgres' AND lifecycle_state='ACTIVE' ORDER BY created_at LIMIT 1")
    if(!/^[A-Za-z0-9:._-]+$/.test(resourceId))throw new Error('managed resource fixture missing')
    psqlValue(sourceCoreUrl,`INSERT INTO greenfield_data_backup_policies(backup_policy_id,resource_id,responsibility,mode,schedule_ref,recovery_point_objective_seconds,recovery_time_objective_seconds,last_backup_ref,last_backup_at,last_restore_test_at,metadata) VALUES ('backup:${resourceId}','${resourceId}','PRODUCT_SERVICE','DECLARED','gbv1-test',3600,3600,NULL,NULL,NULL,'{}')`)
    psqlValue(sourceModuleUrl,"CREATE TABLE fixture_notes(note_id text PRIMARY KEY, body text NOT NULL); INSERT INTO fixture_notes VALUES ('note-1','managed module recovery'),('note-2','second row')")
    const assets=join(scratch,'source-assets'),restoredAssets=join(scratch,'restored-assets'),backupRoot=join(scratch,'backups');mkdirSync(join(assets,'nested'),{recursive:true,mode:0o700});mkdirSync(restoredAssets,{mode:0o700});mkdirSync(backupRoot,{mode:0o700});writeFileSync(join(assets,'avatar.bin'),randomBytes(512));writeFileSync(join(assets,'nested','metadata.json'),JSON.stringify({asset:'fixture',owner:'isolated-test'}))
    const identity=join(scratch,'age-identity.txt'),keygen=capture('age-keygen',['-o',identity]);if(keygen.status!==0)throw new Error('age-keygen failed');const recipient=readFileSync(identity,'utf8').match(/public key:\s*(age1\S+)/)?.[1];if(!recipient)throw new Error('age recipient missing')
    const configPath=join(scratch,'config.json'),targetsPath=join(scratch,'targets.json'),sourceRevision=output('git',['rev-parse','HEAD'])
    writeFileSync(configPath,JSON.stringify({version:1,sourceRevision,databases:[{id:'greenfield-core',role:'GREENFIELD_CORE',urlEnv:'GBV1_SOURCE_CORE_URL'},{id:'fixture-module',role:'MODULE_DATABASE',urlEnv:'GBV1_SOURCE_MODULE_URL',resourceIds:[resourceId]}],assets:[{id:'greenfield-media',role:'MANAGED_ASSETS',pathEnv:'GBV1_SOURCE_ASSETS'}]},null,2))
    writeFileSync(targetsPath,JSON.stringify({version:1,databases:[{id:'greenfield-core',urlEnv:'GBV1_RESTORE_CORE_URL',checks:[{name:'schema-version',sql:"SELECT value FROM schema_metadata WHERE key='schema_version'",expect:'053'}]},{id:'fixture-module',urlEnv:'GBV1_RESTORE_MODULE_URL',checks:[{name:'module-row-count',sql:'SELECT count(*) FROM fixture_notes',expect:'2'}]}],assets:[{id:'greenfield-media',pathEnv:'GBV1_RESTORE_ASSETS'}]},null,2))
    const recoveryEnv={...process.env,MODULA_RECOVERY_AGE_RECIPIENT:recipient,MODULA_RECOVERY_AGE_IDENTITY_FILE:identity,MODULA_RECOVERY_SIGNING_KEY:randomBytes(32).toString('base64url'),MODULA_RECOVERY_SIGNING_KEY_ID:'gbv1-isolated-test',GBV1_SOURCE_CORE_URL:sourceCoreUrl,GBV1_SOURCE_MODULE_URL:sourceModuleUrl,GBV1_SOURCE_ASSETS:assets,GBV1_RESTORE_CORE_URL:restoreCoreUrl,GBV1_RESTORE_MODULE_URL:restoreModuleUrl,GBV1_RESTORE_ASSETS:restoredAssets}
    const backup=capture('node',[tool,'backup','--config',configPath,'--output-root',backupRoot],root,recoveryEnv);record('ENCRYPTED BACKUP SET CREATED',backup.status===0,backup.status===0?'age + ACL-preserving dumps + assets':backup.stderr.trim().slice(0,500));if(backup.status!==0)return
    const backupResult=JSON.parse(backup.stdout.trim()),backupDir=backupResult.backupDir,manifest=JSON.parse(readFileSync(join(backupDir,'manifest.json'),'utf8'))
    record('BACKUP COVERAGE INVENTORIED',manifest.coverage?.schemaVersion==='053'&&manifest.coverage?.dataResources?.managedDedicated===1&&manifest.payloads.length===3,JSON.stringify(manifest.coverage))
    const serialized=readFileSync(join(backupDir,'manifest.json'),'utf8');record('BACKUP MANIFEST SECRET FREE',!serialized.includes(password)&&!serialized.includes(sourceCoreUrl)&&!serialized.includes('secret://'),'no URL, password or secret handle persisted')
    const verify=capture('node',[tool,'verify','--config',configPath,'--backup-dir',backupDir],root,recoveryEnv);record('ENCRYPTION CHECKSUM FORMAT VERIFY',verify.status===0,verify.status===0?'PASS':verify.stderr.trim().slice(0,500))
    const databasePayload=manifest.payloads.find(value=>value.kind==='DATABASE'),payloadPath=join(backupDir,databasePayload.file),original=readFileSync(payloadPath),tampered=Buffer.from(original);tampered[tampered.length-1]^=1;writeFileSync(payloadPath,tampered);const rejected=capture('node',[tool,'verify','--config',configPath,'--backup-dir',backupDir],root,recoveryEnv);record('TAMPERED BACKUP REJECTED',rejected.status!==0&&rejected.stderr.includes('checksum mismatch'));writeFileSync(payloadPath,original)
    const restore=capture('node',[tool,'restore','--config',configPath,'--backup-dir',backupDir,'--targets',targetsPath],root,recoveryEnv);record('ORDERED ISOLATED FULL RESTORE',restore.status===0,restore.status===0?restore.stdout.trim():restore.stderr.trim().slice(0,700));if(restore.status!==0)return
    record('GREENFIELD REGISTRY RECOVERED',psqlValue(restoreCoreUrl,"SELECT count(*) FROM greenfield_module_releases")!=='0')
    record('MODULE DATABASE RECOVERED',psqlValue(restoreModuleUrl,'SELECT count(*) FROM fixture_notes')==='2')
    record('SECRET METADATA TABLES RECOVERED',psqlValue(restoreCoreUrl,"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('greenfield_module_secret_refs','greenfield_connection_credentials')")==='2')
    record('EVENT JOB LEDGERS RECOVERED',psqlValue(restoreCoreUrl,"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('greenfield_domain_events','background_jobs')")==='2')
    record('RUNTIME BACKUP ACL RECOVERED',psqlValue(restoreCoreUrl,"SELECT has_table_privilege('modula_backup','greenfield_account_data_requests','SELECT')")==='t')
    record('MANAGED ASSETS RECOVERED',readFileSync(join(restoredAssets,'nested','metadata.json'),'utf8')===readFileSync(join(assets,'nested','metadata.json'),'utf8'))
    const restoredEnv={...process.env,CI:'true',NODE_ENV:'test',MODULA_TEST_DATABASE_URL:restoreCoreUrl}
    run('RESTORED DATABASE BEHAVIOUR','pnpm',['--filter','@modula/greenfield-api','exec','vitest','run','tests/greenfield-backend-v1.account-data.test.ts'],root,restoredEnv)
    const pending=capture('pnpm',['--filter','@modula/greenfield-api','exec','tsx','-e',"import {migrateStatus} from './src/database/migrate.ts'; void migrateStatus(process.env.MODULA_TEST_DATABASE_URL).then(value=>{console.log(JSON.stringify(value.pending))})"],join(root,'services/greenfield-api'),restoredEnv)
    record('RESTORED DATABASE PENDING MIGRATIONS',pending.status===0&&pending.stdout.includes('[]'),pending.stdout.trim())
  }catch(error){record('ISOLATED RECOVERY EXERCISE',false,error instanceof Error?error.message:String(error))}
  finally{
    for(const database of databases)spawnSync('docker',['exec',container,'dropdb','-U','modula_admin','--if-exists','--force',database],{stdio:'ignore'})
    dockerSql(`DROP ROLE IF EXISTS ${role}`);rmSync(scratch,{recursive:true,force:true});record('RECOVERY FIXTURES REMOVED',true,scratch)
  }
  function dockerSql(sql){return spawnSync('docker',['exec',container,'psql','-U','modula_admin','-d',values.POSTGRES_DB??'modula','-v','ON_ERROR_STOP=1','-c',sql],{stdio:'ignore'}).status===0}
}
function dbUrl(user,password,database){const url=new URL('postgresql://127.0.0.1:5433');url.username=user;url.password=password;url.pathname=`/${database}`;return url.toString()}
function psqlValue(url,sql){const parsed=new URL(url),result=capture('psql',['--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--command',sql],root,{...process.env,PGHOST:parsed.hostname,PGPORT:parsed.port,PGUSER:decodeURIComponent(parsed.username),PGPASSWORD:decodeURIComponent(parsed.password),PGDATABASE:parsed.pathname.slice(1)});if(result.status!==0)throw new Error(result.stderr.trim().slice(0,500));return result.stdout.trim()}
