import type { PoolConfig } from 'pg';

/** URL SSL parameters must not override node-postgres' explicit TLS object. */
export function databasePoolConfig(connectionString:string,options:{production?:boolean;ca?:string}={}):PoolConfig{
  let url:URL;
  try{url=new URL(connectionString);}catch{throw new Error('DATABASE_URL_INVALID');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname)throw new Error('DATABASE_URL_INVALID');
  const local=['localhost','127.0.0.1','[::1]','::1'].includes(url.hostname.toLowerCase());
  for(const key of [...url.searchParams.keys()]){
    if(['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'].includes(key.toLowerCase()))url.searchParams.delete(key);
  }
  return {connectionString:url.toString(),ssl:local&&!options.production?false:{rejectUnauthorized:true,...(options.ca?{ca:options.ca}:{})},
    connectionTimeoutMillis:10000,query_timeout:10000,statement_timeout:10000};
}
