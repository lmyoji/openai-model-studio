import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { handleStudioRequest, openSession, sealSession, validateApiPath, validateBaseUrl } from '../lib/studio/server'
import { buildChatRequest, cosineSimilarity, extractOutput, parseObject, readSSE, type ChatOptions } from '../lib/studio/requests'
import { DOCUMENTED_MODELS, isRetired, mergeAccountModels, modelForId, supportsSection } from '../lib/studio/catalog'

const secret = randomBytes(32).toString('base64url')
const fakeKey = 'sk-test-not-a-real-openai-key-for-protocol-tests'
const origin = 'https://studio.example'
function req(route: string, options: RequestInit = {}, cookie?: string, actor = 'alice') {
  const headers = new Headers(options.headers)
  headers.set('origin', origin); headers.set('oai-authenticated-user-id', actor)
  if (cookie) headers.set('cookie', cookie)
  return new Request(origin + '/api/studio/' + route, { ...options, headers })
}
async function setup(remember = false) {
  const response = await handleStudioRequest(req('session', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({apiKey:fakeKey,baseUrl:'https://api.openai.com/v1',remember})}),secret)
  assert.equal(response.status,200)
  const cookie = response.headers.get('set-cookie')!
  return {cookie:cookie.split(';')[0],response,header:cookie}
}

test('credentials are encrypted, HttpOnly, same-site and masked; encryption uses a fresh nonce',async()=>{
  const a=await setup(),b=await setup()
  assert.notEqual(a.cookie,b.cookie)
  assert.ok(!a.cookie.includes(fakeKey))
  assert.match(a.header,/HttpOnly/);assert.match(a.header,/SameSite=Strict/);assert.match(a.header,/Secure/)
  assert.ok(!a.header.includes('Max-Age'))
  const result=await a.response.text();assert.ok(!result.includes(fakeKey));assert.ok(result.includes('configured'))
  const stored=await openSession(req('session',{},a.cookie),secret)
  assert.equal(stored?.apiKey,fakeKey)
  assert.equal((await setup(true)).header.includes('Max-Age=2592000'),true)
})
test('encrypted sessions are bound to visitor identity and origin and reject tampering and expired data',async()=>{
  const {cookie}=await setup()
  assert.equal(await openSession(req('session',{},cookie,'bob'),secret),null)
  assert.equal(await openSession(new Request('https://other.example/api/studio/session',{headers:{cookie,'oai-authenticated-user-id':'alice'}}),secret),null)
  assert.equal(await openSession(req('session',{},cookie+'broken'),secret),null)
  assert.equal(await openSession(req('session',{},cookie),randomBytes(32).toString('hex')),null)
  const expired=await sealSession({apiKey:fakeKey,baseUrl:'https://api.openai.com/v1',organization:'',project:'',expiresAt:Date.now()-1000},secret,req('session'))
  assert.equal(await openSession(req('session',{},'openai_studio_session='+expired),secret),null)
})
test('unconfigured calls fail locally, cross-origin calls are forbidden, settings have bounded JSON',async()=>{
  let calls=0
  const fakeFetch:typeof fetch=async()=>{calls++;return new Response('{}')}
  assert.equal((await handleStudioRequest(req('request?path=%2Fresponses',{method:'POST'}),secret,fakeFetch)).status,401)
  const cross=new Request(origin+'/api/studio/session',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'})
  assert.equal((await handleStudioRequest(cross,secret,fakeFetch)).status,403)
  assert.equal((await handleStudioRequest(req('session',{method:'POST',headers:{'content-type':'application/json'},body:'null'}),secret)).status,400)
  assert.equal((await handleStudioRequest(req('session',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(33000)}),secret)).status,413)
  assert.equal(calls,0)
})
test('base URLs and paths cannot redirect a credential to another host',()=>{
  assert.equal(validateBaseUrl('https://api.openai.com/v1/'),'https://api.openai.com/v1')
  for(const value of ['http://api.openai.com/v1','https://api.openai.com.evil.example/v1','https://api.openai.com@evil.example/v1','https://user@api.openai.com/v1','https://127.0.0.1/v1','https://api.openai.com/v1?x=1'])assert.throws(()=>validateBaseUrl(value))
  for(const path of ['//evil.example/','/responses/../organization','/responses/%2e%2e/models','/responses/%252e%252e/models','/responses\\models','/responses\nfoo','/not-an-api'])assert.throws(()=>validateApiPath(path))
  assert.equal(validateApiPath('/files/file_123/content?download=1'),'/files/file_123/content?download=1')
})
test('proxy injects credentials server-side, preserves SSE and request IDs and strips untrusted response cookies',async()=>{
  const {cookie}=await setup()
  let calls=0
  const fakeFetch:typeof fetch=async(url,init)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer '+fakeKey);assert.equal(init?.redirect,'error')
    const data=await new Response(init?.body).text();assert.equal(data,'{"model":"test"}')
    return new Response('data: {"type":"response.output_text.delta","delta":"你好"}\n\n',{headers:{'content-type':'text/event-stream','x-request-id':'req_protocol','set-cookie':'evil=1'}})
  }
  const response=await handleStudioRequest(req('request?path=%2Fresponses',{method:'POST',headers:{'content-type':'application/json'},body:'{"model":"test"}'},cookie),secret,fakeFetch)
  assert.equal(response.status,200);assert.equal(response.headers.get('x-request-id'),'req_protocol');assert.equal(response.headers.get('set-cookie'),null)
  assert.ok((await response.text()).includes('你好'));assert.equal(calls,1)
})
test('429 and binary outputs pass through without retrying or converting the body',async()=>{
  const {cookie}=await setup()
  let calls=0
  const limited:typeof fetch=async()=>{calls++;return new Response('{"error":{"message":"quota exceeded"}}',{status:429,headers:{'content-type':'application/json','retry-after':'3'}})}
  const response=await handleStudioRequest(req('request?path=%2Fmodels',{},cookie),secret,limited)
  assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'3');assert.equal(calls,1)
  const bytes=new Uint8Array([82,73,70,70,0,255,64])
  const binary:typeof fetch=async()=>new Response(bytes,{headers:{'content-type':'audio/wav'}})
  const audio=await handleStudioRequest(req('request?path=%2Faudio%2Fspeech',{method:'POST',body:'{}'},cookie),secret,binary)
  assert.deepEqual(new Uint8Array(await audio.arrayBuffer()),bytes)
})
test('multipart upload boundaries remain intact and large declared uploads are rejected',async()=>{
  const {cookie}=await setup()
  const body=new FormData();body.set('purpose','user_data');body.set('file',new File(['hello'],'notes.txt',{type:'text/plain'}))
  const request=req('request?path=%2Ffiles',{method:'POST',body},cookie)
  const contentType=request.headers.get('content-type')
  const fakeFetch:typeof fetch=async(_,init)=>{
    assert.equal(new Headers(init?.headers).get('content-type'),contentType)
    const upstream=new Request('https://api.openai.com/v1/files',{...init,...({duplex:'half'} as Record<string,string>)})
    const form=await upstream.formData();assert.equal(form.get('purpose'),'user_data');assert.equal(await (form.get('file') as File).text(),'hello')
    return Response.json({id:'file_test'})
  }
  assert.equal((await handleStudioRequest(request,secret,fakeFetch)).status,200)
  const large=req('request?path=%2Ffiles',{method:'POST',headers:{'content-length':String(65*1024*1024)},body:'x'},cookie)
  assert.equal((await handleStudioRequest(large,secret,fakeFetch)).status,413)
})
test('clearing a session expires the cookie and updates never expose the full key',async()=>{
  const {cookie}=await setup()
  const update=await handleStudioRequest(req('session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'https://eu.api.openai.com/v1'})},cookie),secret)
  assert.equal(update.status,200);assert.ok(!(await update.text()).includes(fakeKey))
  const response=await handleStudioRequest(req('session',{method:'DELETE'},cookie),secret)
  assert.match(response.headers.get('set-cookie')!,/Max-Age=0/)
})
test('SSE parser handles split CRLF, split UTF-8, multiple frames and an unterminated final event',async()=>{
  const source='data: {"type":"response.output_text.delta","delta":"你好"}\r\n\r\ndata: {"type":"response.completed","response":{"id":"resp_ok"}}'
  const bytes=new TextEncoder().encode(source)
  const stream=new ReadableStream<Uint8Array>({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close()}})
  const events:Record<string,unknown>[]=[]
  await readSSE(new Response(stream),e=>events.push(e))
  assert.equal(events.length,2);assert.equal(events[0].delta,'你好');assert.equal(events[1].type,'response.completed')
})
test('SSE errors and failed responses surface as failures',async()=>{
  await assert.rejects(readSSE(new Response('data: {"type":"response.failed","response":{"error":{"message":"model is unavailable"}}}\n\n'),()=>{}),/model is unavailable/)
  await assert.rejects(readSSE(new Response('data: not-json\n\n'),()=>{}),/SSE/)
})
const model=modelForId('gpt-6.1-sol')!
const options:ChatOptions={model,messages:[{id:'u',role:'user',text:'你好'}],instructions:'中文回答',endpoint:'/responses',reasoning:'low',maxTokens:'200',temperature:'',webSearch:false,codeInterpreter:false,vectorStores:'',imageGeneration:false,jsonSchema:'',advanced:'',stream:true}
test('Responses payload uses official input, instructions, reasoning and optional tool fields',()=>{
  const r=buildChatRequest({...options,webSearch:true,vectorStores:'vs_a, vs_b'})
  assert.equal(r.path,'/responses');assert.equal(r.body.store,false);assert.equal(r.body.max_output_tokens,200);assert.deepEqual(r.body.reasoning,{effort:'low'});assert.ok(!('temperature'in r.body))
  assert.deepEqual(r.body.tools,[{type:'web_search'},{type:'file_search',vector_store_ids:['vs_a','vs_b']}])
})
test('Chat Completions and legacy payloads use their own fields and reject incompatible tool or attachment shapes',()=>{
  const r=buildChatRequest({...options,endpoint:'/chat/completions'})
  assert.ok('messages'in r.body);assert.equal(r.body.max_completion_tokens,200);assert.ok(!('input'in r.body));assert.equal(r.body.reasoning_effort,'low')
  assert.throws(()=>buildChatRequest({...options,endpoint:'/chat/completions',webSearch:true}),/Responses/)
  assert.throws(()=>buildChatRequest({...options,endpoint:'/completions',jsonSchema:'{}'}))
  const legacy=buildChatRequest({...options,endpoint:'/completions'});assert.ok('prompt'in legacy.body);assert.ok(!('messages'in legacy.body))
})
test('multimodal Responses preserves image and PDF data, and incomplete assistant text is not replayed',()=>{
  const r=buildChatRequest({...options,messages:[{id:'u',role:'user',text:'分析',attachments:[{id:'f',name:'doc.pdf',mime:'application/pdf',data:'data:application/pdf;base64,AA==',size:1},{id:'i',name:'image.png',mime:'image/png',data:'data:image/png;base64,AA==',size:1}]},{id:'a',role:'assistant',text:'unfinished',status:'interrupted'}]})
  const input=r.body.input as {content:unknown[]}[];assert.equal(input.length,1);assert.equal(input[0].content.length,3)
})
test('parameter validation and structured output reject invalid JSON before a paid request',()=>{
  for(const value of ['null','[]','{broken'])assert.throws(()=>parseObject(value))
  assert.throws(()=>buildChatRequest({...options,maxTokens:'-1'}))
  assert.throws(()=>buildChatRequest({...options,temperature:'NaN'}))
  const r=buildChatRequest({...options,advanced:'{"store":true,"max_output_tokens":300}'})
  assert.equal(r.body.store,true);assert.equal(r.body.max_output_tokens,300)
})
test('catalog is complete for downloaded model docs and endpoint selection respects modalities',()=>{
  assert.equal(DOCUMENTED_MODELS.length,103);assert.equal(new Set(DOCUMENTED_MODELS.map(m=>m.id)).size,103)
  assert.ok(DOCUMENTED_MODELS.every(m=>m.sourceVerified))
  assert.equal(supportsSection(model,'chat'),true)
  assert.equal(supportsSection(modelForId('gpt-image-2.5-sunburst')!,'images'),true)
  assert.equal(supportsSection(modelForId('gpt-audio-1.5')!,'chat'),false)
  assert.equal(supportsSection(modelForId('gpt-audio-1.5')!,'audio'),true)
  assert.equal(supportsSection(modelForId('gpt-live-1')!,'realtime'),true)
  assert.equal(isRetired(modelForId('gpt-4.5-preview')!,'2026-10-29'),true)
})
test('account models preserve snapshots, unknown IDs and custom fine-tuned IDs without hiding them',()=>{
  const all=mergeAccountModels([{id:'gpt-6.1-sol'},{id:'ft:gpt-4.1-mini-2025-04-14:org:custom:123'},{id:'future-new-model'}],true)
  assert.equal(all.find(m=>m.id==='gpt-6.1-sol')?.accountAvailable,true)
  assert.equal(all.find(m=>m.id==='future-new-model')?.undocumented,true)
  assert.equal(all.find(m=>m.id.startsWith('ft:'))?.accountAvailable,true)
  assert.equal(all.find(m=>m.id==='gpt-6-astra')?.accountAvailable,false)
  assert.equal(modelForId('gpt-6.1-sol-2099-01-01')?.id,'gpt-6.1-sol-2099-01-01')
})
test('output extraction handles refusals, tool calls and audio transcripts; vector comparison is stable',()=>{
  assert.equal(extractOutput({output:[{type:'message',content:[{type:'refusal',refusal:'无法完成'}]}]}),'无法完成')
  assert.match(extractOutput({output:[{type:'function_call',name:'weather',arguments:'{}'}]}),/weather/)
  assert.equal(extractOutput({choices:[{message:{audio:{transcript:'hello'}}}]}),'hello')
  assert.equal(cosineSimilarity([1,0],[1,0]),1);assert.equal(cosineSimilarity([1,0],[0,1]),0);assert.equal(cosineSimilarity([0,0],[0,0]),0)
})
