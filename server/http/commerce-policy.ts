/** No real gateway has been selected or integrated. Production cannot use mocks. */
export function commercePolicy(environment:string){
  return {provider:null,live_checkout_available:false,
    sandbox_available:environment!=='production',
    unavailable_reason:'PAYMENT_PROVIDER_NOT_CONFIGURED'} as const;
}
export function runtimeEnvironment(value:string|undefined):'development'|'test'|'production'{
  const mode=value??'development';
  if(mode!=='development'&&mode!=='test'&&mode!=='production')throw new Error('NODE_ENV_INVALID');
  return mode;
}
