#!/usr/bin/env node
import {createHash, createHmac, timingSafeEqual} from 'node:crypto'
import {chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs'
import {isAbsolute, join, resolve, sep} from 'node:path'
import {spawn} from 'node:child_process'

const command=process.argv[2],args=parseArgs(process.argv.slice(3))
process.umask(0o077)
if(!['backup','verify','restore'].includes(command??'')) usage()
const config=loadJson(requiredArg('config'))
validateConfig(config)
if(command==='backup') await backup(config)
if(command==='verify') await verify(config)
if(command==='restore') await restore(config)

async function backup(config){
  const outputRoot=safeRoot(requiredArg('output-root'),'backup output root'),recipient=ageRecipient(),signingKey=recoverySigningKey()
  const createdAt=new Date().toISOString(),stamp=createdAt.replaceAll(/[-:.]/g,'').replace('Z','Z'),setId=`gbv1-recovery-${stamp}`,partial=join(outputRoot,`.${setId}.partial`),final=join(outputRoot,setId)
  if(existsSync(partial)||existsSync(final)) fail('backup set already exists')
  mkdirSync(join(partial,'payloads'),{recursive:true,mode:0o700})
  try{
    const core=config.databases.find(value=>value.role==='GREENFIELD_CORE'),coreInventory=core?await greenfieldInventory(databaseConnection(core)):null
    validateManagedCoverage(config,coreInventory)
    const payloads=[]
    for(const database of config.databases){
      const file=`payloads/database-${safeId(database.id)}.dump.age`,path=join(partial,file),connection=databaseConnection(database)
      await pipeline({command:'pg_dump',args:['--format=custom','--no-password'],env:connection.env},{command:'age',args:['--encrypt','--recipient',recipient,'--output',path]})
      chmodFile(path)
      await pipeline({command:'age',args:['--decrypt','--identity',identityFile(),path]},{command:'pg_restore',args:['--list']})
      const identity=await query(connection,"SELECT current_database() || ':' || current_setting('server_version_num')")
      payloads.push({id:database.id,kind:'DATABASE',role:database.role,file,sha256:sha256File(path),byteLength:statSync(path).size,sourceIdentityHash:sha256(identity),requiredRoles:await requiredDatabaseRoles(connection),resourceIds:(database.resourceIds??[]).map(sha256)})
    }
    for(const asset of config.assets??[]){
      const root=assetRoot(asset);validateAssetTree(root)
      const file=`payloads/assets-${safeId(asset.id)}.tar.gz.age`,path=join(partial,file),beforeDigest=assetDigest(root)
      await pipeline({command:'tar',args:['--create','--gzip','--file=-','--directory',root,'.']},{command:'age',args:['--encrypt','--recipient',recipient,'--output',path]})
      chmodFile(path)
      const afterDigest=assetDigest(root);if(beforeDigest!==afterDigest)fail(`asset source changed during backup: ${asset.id}`)
      payloads.push({id:asset.id,kind:'ASSETS',role:asset.role??'MANAGED_ASSETS',file,sha256:sha256File(path),byteLength:statSync(path).size,fileCount:assetFiles(root).length,contentSha256:afterDigest,resourceIds:(asset.resourceIds??[]).map(sha256)})
    }
    const manifest={format:'modula.greenfield.recovery.v1',backupSetId:setId,createdAt,sourceRevision:config.sourceRevision,postgresFormat:'custom-acl-preserving',encryption:{algorithm:'age',recipientFingerprint:sha256(recipient)},integrity:{algorithm:'HMAC-SHA256',keyId:requiredEnv('MODULA_RECOVERY_SIGNING_KEY_ID')},restoreOrder:['GREENFIELD_CORE','REGISTRY_INSTALLATIONS','SERVICE_DATA_BINDINGS','SECRET_METADATA','BUILD_METADATA','MODULE_DATABASE','MANAGED_ASSETS','EVENT_JOB_RECONCILIATION'],coverage:coreInventory?redactInventory(coreInventory):null,payloads}
    const encoded=`${JSON.stringify(manifest,null,2)}\n`;writeSecure(join(partial,'manifest.json'),encoded);writeSecure(join(partial,'manifest.hmac'),`${createHmac('sha256',signingKey).update(encoded).digest('hex')}\n`);writeSecure(join(partial,'checksums.sha256'),payloads.map(value=>`${value.sha256}  ${value.file}`).join('\n')+'\n')
    renameSync(partial,final);console.log(JSON.stringify({ok:true,operation:'backup',backupSetId:setId,backupDir:final,payloadCount:payloads.length,coverage:manifest.coverage}))
  }catch(error){rmSync(partial,{recursive:true,force:true});throw error}
}

async function verify(config){
  const backupDir=safeExistingDir(requiredArg('backup-dir'),'backup directory'),manifest=verifyManifest(backupDir),identity=identityFile()
  for(const payload of manifest.payloads){
    const path=payloadPath(backupDir,payload);if(sha256File(path)!==payload.sha256)fail(`payload checksum mismatch: ${payload.id}`)
    if(payload.kind==='DATABASE')await pipeline({command:'age',args:['--decrypt','--identity',identity,path]},{command:'pg_restore',args:['--list']})
    else {const listing=await pipeline({command:'age',args:['--decrypt','--identity',identity,path]},{command:'tar',args:['--list','--gzip','--file=-']},{capture:true});validateArchiveListing(listing.stdout)}
  }
  console.log(JSON.stringify({ok:true,operation:'verify',backupSetId:manifest.backupSetId,payloadCount:manifest.payloads.length}))
}

async function restore(config){
  const backupDir=safeExistingDir(requiredArg('backup-dir'),'backup directory'),targets=loadJson(requiredArg('targets')),manifest=verifyManifest(backupDir),identity=identityFile()
  validateTargets(targets,manifest)
  const restored=[]
  for(const role of manifest.restoreOrder){
    for(const payload of manifest.payloads.filter(value=>value.role===role||role==='MODULE_DATABASE'&&value.role==='MODULE_DATABASE')){
      if(restored.includes(payload.id))continue
      const target=targetFor(targets,payload),path=payloadPath(backupDir,payload)
      if(sha256File(path)!==payload.sha256)fail(`payload checksum mismatch: ${payload.id}`)
      if(payload.kind==='DATABASE'){
        const connection=connectionFromEnv(target.urlEnv),roles=await databaseRoles(connection)
        await assertEmptyRestoreDatabase(connection)
        for(const required of payload.requiredRoles??[])if(!roles.includes(required))fail(`restore target missing database role ${required}`)
        await pipeline({command:'age',args:['--decrypt','--identity',identity,path]},{command:'pg_restore',args:['--exit-on-error','--single-transaction','--clean','--if-exists','--dbname',connection.database],env:connection.env})
        for(const check of target.checks??[]){const actual=await query(connection,check.sql);if(String(actual)!==String(check.expect))fail(`restore check failed: ${payload.id}/${check.name}`)}
      }else{
        const destination=safeRestorePath(requiredEnv(target.pathEnv),`asset restore target ${payload.id}`);if(readdirSync(destination).length)fail(`asset restore target must be empty: ${payload.id}`)
        const listing=await pipeline({command:'age',args:['--decrypt','--identity',identity,path]},{command:'tar',args:['--list','--gzip','--file=-']},{capture:true});validateArchiveListing(listing.stdout)
        await pipeline({command:'age',args:['--decrypt','--identity',identity,path]},{command:'tar',args:['--extract','--gzip','--file=-','--directory',destination,'--no-same-owner']})
        if(assetDigest(destination)!==payload.contentSha256)fail(`restored asset digest mismatch: ${payload.id}`)
      }
      restored.push(payload.id)
    }
  }
  for(const payload of manifest.payloads)if(!restored.includes(payload.id))fail(`payload omitted from restore order: ${payload.id}`)
  console.log(JSON.stringify({ok:true,operation:'restore',backupSetId:manifest.backupSetId,restored,order:manifest.restoreOrder}))
}

function verifyManifest(backupDir){
  const manifestPath=join(backupDir,'manifest.json'),signaturePath=join(backupDir,'manifest.hmac');if(!existsSync(manifestPath)||!existsSync(signaturePath))fail('backup manifest or signature missing')
  const encoded=readFileSync(manifestPath),expected=createHmac('sha256',recoverySigningKey()).update(encoded).digest(),provided=Buffer.from(readFileSync(signaturePath,'utf8').trim(),'hex')
  if(expected.length!==provided.length||!timingSafeEqual(expected,provided))fail('backup manifest signature invalid')
  const manifest=JSON.parse(encoded.toString('utf8'));if(manifest.format!=='modula.greenfield.recovery.v1'||!Array.isArray(manifest.payloads))fail('unsupported recovery manifest')
  return manifest
}

async function greenfieldInventory(connection){
  const schemaVersion=await query(connection,"SELECT value FROM schema_metadata WHERE key='schema_version'")
  const hasResourceLedger=await tableExists(connection,'greenfield_data_resources')
  const resources=hasResourceLedger?JSON.parse(await query(connection,"SELECT COALESCE(json_agg(json_build_object('resourceId',r.resource_id,'productId',r.product_id,'installationId',r.installation_id,'storageMode',r.primary_storage_mode,'lifecycleState',r.lifecycle_state,'responsibility',COALESCE(p.responsibility,'NOT_DECLARED'),'backupMode',COALESCE(p.mode,'NOT_DECLARED')) ORDER BY r.resource_id),'[]'::json)::text FROM greenfield_data_resources r LEFT JOIN greenfield_data_backup_policies p ON p.resource_id=r.resource_id WHERE r.lifecycle_state <> 'DELETED'")):[]
  const countTables={accounts:'greenfield_accounts',registry:'greenfield_module_releases',installations:'greenfield_extension_installations',events:'greenfield_domain_events',jobs:'background_jobs',entitlements:'greenfield_entitlements',builds:'greenfield_developer_builds',accountDataRequests:'greenfield_account_data_requests'}
  const counts=Object.fromEntries(await Promise.all(Object.entries(countTables).map(async([name,table])=>[name,await tableCount(connection,table)])))
  return {schemaVersion,resources,counts}
}
async function tableExists(connection,table){validateSqlIdentifier(table);return await query(connection,`SELECT to_regclass('public.${table}') IS NOT NULL`)==='t'}
async function tableCount(connection,table){validateSqlIdentifier(table);return await tableExists(connection,table)?Number(await query(connection,`SELECT count(*) FROM ${table}`)):0}
function validateSqlIdentifier(value){if(!/^[a-z][a-z0-9_]{0,62}$/.test(value))fail('invalid database identifier')}
function validateManagedCoverage(config,inventory){if(!inventory)return;const active=inventory.resources.filter(value=>['ACTIVE','DISABLED','RETAINED'].includes(value.lifecycleState)),unclassified=active.filter(value=>['dedicated-postgres','object-storage'].includes(value.storageMode)&&value.responsibility==='NOT_DECLARED');if(unclassified.length)fail(`backup policy missing for ${unclassified.length} managed resource(s)`);const coveredDatabases=new Set(config.databases.flatMap(value=>value.resourceIds??[])),requiredDatabases=active.filter(value=>value.storageMode==='dedicated-postgres'&&['GREENFIELD','PRODUCT_SERVICE'].includes(value.responsibility)),missingDatabases=requiredDatabases.filter(value=>!coveredDatabases.has(value.resourceId));if(missingDatabases.length)fail(`managed module database coverage missing for ${missingDatabases.length} resource(s)`);const coveredAssets=new Set((config.assets??[]).flatMap(value=>value.resourceIds??[])),requiredAssets=active.filter(value=>value.storageMode==='object-storage'&&['GREENFIELD','PRODUCT_SERVICE'].includes(value.responsibility)),missingAssets=requiredAssets.filter(value=>!coveredAssets.has(value.resourceId));if(missingAssets.length)fail(`managed object storage coverage missing for ${missingAssets.length} resource(s)`)}
function redactInventory(inventory){return{schemaVersion:inventory.schemaVersion,counts:inventory.counts,dataResources:{total:inventory.resources.length,byStorageMode:groupCount(inventory.resources,'storageMode'),byBackupResponsibility:groupCount(inventory.resources,'responsibility'),managedDedicated:inventory.resources.filter(value=>value.storageMode==='dedicated-postgres'&&['GREENFIELD','PRODUCT_SERVICE'].includes(value.responsibility)).length}}}
function groupCount(values,key){return Object.fromEntries([...new Set(values.map(value=>value[key]))].sort().map(name=>[name,values.filter(value=>value[key]===name).length]))}

function validateConfig(value){if(value?.version!==1||!Array.isArray(value.databases)||!value.databases.length)fail('recovery config version 1 with databases is required');if(value.databases.filter(item=>item.role==='GREENFIELD_CORE').length!==1)fail('exactly one GREENFIELD_CORE database is required');const ids=new Set();for(const database of value.databases){validateId(database.id);if(ids.has(database.id))fail('duplicate recovery database id');ids.add(database.id);if(!['GREENFIELD_CORE','MODULE_DATABASE','SECRET_METADATA','BUILD_METADATA'].includes(database.role))fail(`invalid database role: ${database.id}`);requiredString(database.urlEnv,'database urlEnv');if(database.role==='MODULE_DATABASE'&&(!Array.isArray(database.resourceIds)||!database.resourceIds.length))fail(`module database resourceIds are required: ${database.id}`)}for(const asset of value.assets??[]){validateId(asset.id);requiredString(asset.pathEnv,'asset pathEnv')}if(typeof value.sourceRevision!=='string'||!/^[0-9a-f]{40}$/.test(value.sourceRevision))fail('sourceRevision must be an exact 40-character Git SHA')}
function validateTargets(value,manifest){if(value?.version!==1||!Array.isArray(value.databases))fail('restore targets version 1 are required');for(const payload of manifest.payloads){const target=targetFor(value,payload);if(payload.kind==='DATABASE')requiredString(target.urlEnv,'target urlEnv');else requiredString(target.pathEnv,'target pathEnv')}}
function targetFor(targets,payload){const values=payload.kind==='DATABASE'?targets.databases:targets.assets??[];const value=values.find(item=>item.id===payload.id);if(!value)fail(`restore target missing: ${payload.id}`);return value}
function databaseConnection(database){return connectionFromEnv(database.urlEnv)}
function connectionFromEnv(name){return parseDatabaseUrl(requiredEnv(name))}
function parseDatabaseUrl(value){const url=new URL(value);if(!['postgres:','postgresql:'].includes(url.protocol))fail('only PostgreSQL recovery targets are supported');const database=decodeURIComponent(url.pathname.replace(/^\//,''));if(!database)fail('database name missing');return{database,env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:database,PGCONNECT_TIMEOUT:'10',PGAPPNAME:'modula-gbv1-recovery'}}}
async function query(connection,sql){const result=await run({command:'psql',args:['--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--command',sql],env:connection.env},{capture:true});return result.stdout.trim()}
async function databaseRoles(connection){const result=await query(connection,"SELECT rolname FROM pg_roles ORDER BY rolname");return result.split('\n').filter(Boolean)}
async function requiredDatabaseRoles(connection){const result=await query(connection,"SELECT rolname FROM pg_roles WHERE rolname IN (current_user,'modula_migrator','modula_api','modula_worker','modula_backup','modula_readonly') ORDER BY rolname");return result.split('\n').filter(Boolean)}
async function assertEmptyRestoreDatabase(connection){if(!/(restore|recovery|(^|_)dr(_|$)|test)/i.test(connection.database)||['modula','postgres','template0','template1'].includes(connection.database.toLowerCase()))fail(`restore target is not positively identified as isolated: ${connection.database}`);const count=await query(connection,"SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')");if(count!=='0')fail(`restore database must be empty before destructive restore: ${connection.database}`)}

async function pipeline(left,right,options={}){
  const a=spawn(left.command,left.args,{env:left.env??process.env,stdio:['ignore','pipe','pipe']}),b=spawn(right.command,right.args,{env:right.env??process.env,stdio:['pipe',options.capture?'pipe':'ignore','pipe']});a.stdout.pipe(b.stdin)
  a.stdout.on('error',error=>{if(error.code!=='EPIPE')throw error});b.stdin.on('error',error=>{if(error.code!=='EPIPE')throw error})
  let terminatedAfterDownstream=false;b.once('close',()=>{a.stdout.unpipe(b.stdin);a.stdout.destroy();if(a.exitCode===null){terminatedAfterDownstream=true;a.kill('SIGTERM')}})
  const aErr=collect(a.stderr),bErr=collect(b.stderr),stdout=options.capture?collect(b.stdout):Promise.resolve('');const [aCode,bCode,aMessage,bMessage,out]=await Promise.all([exitCode(a),exitCode(b),aErr,bErr,stdout]);if(bCode||(aCode&&!terminatedAfterDownstream))fail(`${left.command}/${right.command} failed: ${bounded(aMessage||bMessage)}`);return{stdout:out}
}
async function run(spec,options={}){const child=spawn(spec.command,spec.args,{env:spec.env??process.env,stdio:['ignore',options.capture?'pipe':'ignore','pipe']}),stderr=collect(child.stderr),stdout=options.capture?collect(child.stdout):Promise.resolve(''),[code,error,out]=await Promise.all([exitCode(child),stderr,stdout]);if(code)fail(`${spec.command} failed: ${bounded(error)}`);return{stdout:out}}
function collect(stream){return new Promise(resolve=>{let value='';stream?.setEncoding('utf8');stream?.on('data',chunk=>{if(value.length<32_000)value+=chunk});stream?.on('end',()=>resolve(value));if(!stream)resolve('')})}
function exitCode(child){return new Promise(resolve=>{child.once('error',()=>resolve(127));child.once('close',code=>resolve(code??1))})}
function bounded(value){return String(value).replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gi,'[redacted-database-url]').slice(0,1000).trim()}

function assetRoot(asset){return safeExistingDir(requiredEnv(asset.pathEnv),`asset root ${asset.id}`)}
function assetFiles(root){const output=[];walk(root,'');return output.sort();function walk(current,prefix){for(const name of readdirSync(current).sort()){const path=join(current,name),rel=prefix?`${prefix}/${name}`:name,info=lstatSync(path);if(info.isSymbolicLink())fail(`asset root contains symlink: ${rel}`);if(info.isDirectory())walk(path,rel);else if(info.isFile())output.push(rel);else fail(`asset root contains unsupported entry: ${rel}`)}}}
function validateAssetTree(root){for(const file of assetFiles(root)){if(file.includes('..')||file.includes('\\'))fail('unsafe asset path')}}
function assetDigest(root){const hash=createHash('sha256');for(const file of assetFiles(root)){hash.update(file);hash.update('\0');hash.update(readFileSync(join(root,file)));hash.update('\0')}return hash.digest('hex')}
function validateArchiveListing(value){for(const raw of value.split('\n').filter(Boolean)){const name=raw.replace(/^\.\//,'');if(isAbsolute(name)||name==='..'||name.startsWith('../')||name.includes('/../')||name.includes('\\'))fail('unsafe archive path') }}
function payloadPath(root,payload){const path=resolve(root,payload.file),prefix=`${resolve(root)}${sep}`;if(!path.startsWith(prefix)||!existsSync(path)||!statSync(path).isFile())fail(`invalid payload path: ${payload.id}`);return path}
function safeRoot(value,label){const path=resolve(value);if(!isAbsolute(path)||['/','/root','/var','/tmp'].includes(path))fail(`${label} must be a dedicated absolute directory`);mkdirSync(path,{recursive:true,mode:0o700});const info=statSync(path);if(!info.isDirectory())fail(`${label} is not a directory`);if((info.mode&0o077)!==0)fail(`${label} must have owner-only permissions`);return path}
function safeExistingDir(value,label){const path=resolve(value);if(!existsSync(path)||!isAbsolute(path)||['/','/root','/var','/tmp'].includes(path)||!statSync(path).isDirectory())fail(`${label} must be an existing dedicated absolute directory`);return path}
function safeRestorePath(value,label){const path=safeRoot(value,label);if(!/(restore|recovery|(^|[._/-])dr([._/-]|$)|test)/i.test(path))fail(`${label} is not positively identified as isolated`);return path}
function sha256File(path){const hash=createHash('sha256'),fd=openSync(path,'r'),buffer=Buffer.alloc(1024*1024);try{let count;while((count=readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,count))}finally{closeSync(fd)}return hash.digest('hex')}
function sha256(value){return createHash('sha256').update(String(value)).digest('hex')}
function chmodFile(path){chmodSync(path,0o600)}
function writeSecure(path,value){writeFileSync(path,value,{mode:0o600,flag:'wx'})}
function safeId(value){validateId(value);return value}
function validateId(value){if(typeof value!=='string'||!/^[a-z0-9][a-z0-9._-]{1,100}$/.test(value))fail('recovery identifiers must be lowercase and bounded')}
function requiredString(value,label){if(typeof value!=='string'||!value.trim())fail(`${label} is required`);return value.trim()}
function requiredEnv(name){const value=process.env[name];if(!value)fail(`required environment variable missing: ${name}`);return value}
function ageRecipient(){const value=requiredEnv('MODULA_RECOVERY_AGE_RECIPIENT');if(!/^age1[0-9a-z]{20,}$/.test(value))fail('MODULA_RECOVERY_AGE_RECIPIENT must be an age public recipient');return value}
function identityFile(){const path=resolve(requiredEnv('MODULA_RECOVERY_AGE_IDENTITY_FILE'));if(!existsSync(path)||!statSync(path).isFile()||(statSync(path).mode&0o077)!==0)fail('age identity file must exist with owner-only permissions');return path}
function recoverySigningKey(){const value=requiredEnv('MODULA_RECOVERY_SIGNING_KEY');if(Buffer.byteLength(value)<32)fail('MODULA_RECOVERY_SIGNING_KEY must contain at least 32 bytes');return value}
function requiredArg(name){const value=args[name];if(!value)fail(`--${name} is required`);return value}
function loadJson(path){return JSON.parse(readFileSync(resolve(path),'utf8'))}
function parseArgs(values){const result={};for(let index=0;index<values.length;index+=2){const name=values[index];if(!name?.startsWith('--')||values[index+1]===undefined)usage();result[name.slice(2)]=values[index+1]}return result}
function usage(){console.error('usage: greenfield-backend-v1-recovery.mjs <backup|verify|restore> --config <file> [--output-root <dir>|--backup-dir <dir> --targets <file>]');process.exit(2)}
function fail(message){throw new Error(message)}
