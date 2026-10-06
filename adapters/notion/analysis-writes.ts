import { isAnalysis, type AnalysisBlock, type InlineSegment } from "../../core/contracts/analysis";
import type { Diagnostic } from "../../core/contracts/common";
import type { SaveAnalysisInput, SaveAnalysisReceipt } from "../../core/services/ports";
import { normalizeNotionPageId, notionSources, documentUpsertStatement, ensureCompanyLinkTable, ensureRelationTable } from "./sync";
import { propertyEntry, propertyValue, propertyName } from "./investment-data";

type RecordValue = Record<string, unknown>;
type Page = { id:string; last_edited_time:string; parent?:RecordValue; archived?:boolean; in_trash?:boolean; properties:RecordValue };
type Journal = { digest:string; page_id:string|null; phase:string; owner:string|null; lease_until:number; previous_current:string|null };
export type NotionWriteOptions = { onDiagnostic?:(diagnostic:Diagnostic)=>void; token:string; fetch?:typeof fetch; sleep?:(ms:number)=>Promise<void>; attempts?:number; timeoutMs?:number; sources?:Partial<Record<keyof typeof notionSources,string>> };
const object=(value:unknown):RecordValue=>value&&typeof value==="object"?value as RecordValue:{};
const id=(value:unknown)=>normalizeNotionPageId(String(value??""));
const uuid=(value:string)=>/^[a-f0-9]{32}$/.test(id(value));
const fault=(code:string)=>Object.assign(new Error("Écriture Notion interrompue."),{code});
const transient=(error:unknown)=>["network","timeout","rate_limit"].includes(String(object(error).code));
const text=(value:string)=>(value.match(/[\s\S]{1,2000}/g)??[" "]).map(content=>({type:"text",text:{content}}));
const agents:Record<string,string>={business:"Business Analyst",valuation:"Valuation Analyst",short:"Short Seller",portfolio:"Portfolio Manager",cio_memo:"Investment Memo",earnings:"Earnings",decision:"Investment Decision"};
const currentProperties:Record<string,string[]>={business:["Current Business Analysis"],valuation:["Current Valuation Analysis"],short:["Current Short Analysis"],portfolio:["Current Portfolio Analysis"],cio_memo:["Current Investment Memo"],decision:["Current Decision","Current Investment Decision","Latest Decision"],earnings:["Current Earnings Analysis","Latest Earnings"]};
function richText(segments:InlineSegment[]){return segments.flatMap(segment=>{
  const pieces=segment.text.match(/[\s\S]{1,2000}/g)??[""];
  return pieces.map(content=>({type:"text",text:{content,...(segment.href?{link:{url:segment.href}}:{})},annotations:{bold:segment.marks.includes("bold"),italic:segment.marks.includes("italic"),strikethrough:segment.marks.includes("strikethrough"),code:segment.marks.includes("code"),underline:false,color:"default"}}));
});}
/** Write-side mapping only; the existing normalizer remains the sole content reader. */
function blocksFor(blocks:AnalysisBlock[]):RecordValue[]{return blocks.flatMap(block=>{
  const wrap=(type:string,body:RecordValue)=>({object:"block",type,[type]:body});
  if(block.type==="unsupported")throw fault("invalid_input");
  if(block.type==="divider")return [wrap("divider",{})];
  if(block.type==="list")return block.items.map(item=>wrap(block.ordered?"numbered_list_item":"bulleted_list_item",{rich_text:richText(item)}));
  if(block.type==="table"){
    if(!block.rows.length||!block.rows[0].length||block.rows.some(row=>row.length!==block.rows[0].length))throw fault("invalid_input");
    return [wrap("table",{table_width:block.rows[0].length,has_column_header:block.header,has_row_header:false,children:block.rows.map(row=>wrap("table_row",{cells:row.map(richText)}))})];
  }
  if(block.type==="heading"&&block.level>3)throw fault("invalid_input");
  const type=block.type==="heading"?`heading_${block.level}`:block.type;
  return [wrap(type,{rich_text:richText(block.text),...(block.type==="callout"&&block.icon?{icon:{type:"emoji",emoji:block.icon}}:{})})];
});}
// Ignore server-generated block IDs/timestamps and text annotations defaults in re-read comparisons.
function semanticBlock(value:unknown,expected:unknown=value):unknown {
  const b=object(value),type=String(b.type),body=object(b[type]);
  const rich=(items:unknown)=>Array.isArray(items)?items.map(item=>{const r=object(item),t=object(r.text),a=object(r.annotations);return {text:String(t.content??r.plain_text??""),href:object(t.link).url??r.href??null,marks:["bold","italic","strikethrough","code","underline"].filter(mark=>a[mark]===true),color:a.color??"default"};}):[];
  if(type==="table")return {type,width:body.table_width,header:body.has_column_header===true,rowHeader:body.has_row_header===true,children:(Array.isArray(body.children)?body.children:[]).map(child=>semanticBlock(child))};
  if(type==="table_row")return {type,cells:(Array.isArray(body.cells)?body.cells:[]).map(rich)};
  // Only an unspecified callout icon permits provider decoration; explicit icons stay strict.
  return {type,text:rich(body.rich_text),icon:type==="callout"&&object(object(expected)[type]).icon==null?null:body.icon??null};
}
// Provider limits apply to each emitted request, including nested table rows and rich text.
function validateProviderBody(body:unknown){
  if(new TextEncoder().encode(JSON.stringify(body)).byteLength>500000)throw fault("invalid_input");
  let blocks=0;
  function visit(value:unknown,key=""){
    if(Array.isArray(value)){if(value.length>100)throw fault("invalid_input");value.forEach(item=>visit(item,key));}
    else if(value&&typeof value==="object"){
      if(object(value).object==="block"&&++blocks>1000)throw fault("invalid_input");
      for(const [name,item] of Object.entries(value))visit(item,name);
    }else if(typeof value==="string"&&(key==="content"||key==="url")&&value.length>2000)throw fault("invalid_input");
  }
  visit(body);
}
const canonicalJson=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function blocksMatch(observed:RecordValue[],expected:RecordValue[]):boolean {
  return equal(observed.map((block,index)=>semanticBlock(block,expected[index])),expected.map(block=>semanticBlock(block)));
}

/** Pure, network-free Notion property mapping. Issues name schema fields and types only, never values. */
export function mapAnalysisProperties(input:SaveAnalysisInput,schema:RecordValue):{properties:RecordValue;issues:string[]}{
  const defs=object(schema.properties),out:RecordValue={},issues:string[]=[];
  const aliases:[string[],string[]][]=[
    [["Run ID"],["rich_text"]],[["Company","Companies"],["relation"]],
    [["Agent"],["select","rich_text"]],[["Status"],["status","select"]],
    [["Analysis Date","Date","Decision Date","Earnings Date"],["date"]],
  ];
  for(const [names,types] of aliases){
    const name=propertyName(defs,names),label=names.join("/");
    if(!name){issues.push(`missing ${label} (expected ${types.join(" or ")})`);continue;}
    const actual=String(object(defs[name]).type??"unknown");
    if(!types.includes(actual))issues.push(`${name} has type ${actual} (expected ${types.join(" or ")})`);
  }
  function put(names:string[],value:unknown,required=false,requireConfiguredOption=false){
    const name=propertyName(defs,names);
    if(!name){if(required&&!issues.some(issue=>issue.startsWith(`missing ${names.join("/")} (`)))issues.push(`missing ${names.join("/")} (required)`);return;}
    const type=String(object(defs[name]).type);
    if(type==="title"||type==="rich_text")out[name]={[type]:value===null?[]:text(String(value))};
    else if(type==="select"||type==="status"){
      if(value!==null){
        const typeSchema=object(object(defs[name])[type]),configured=typeSchema.options;
        if(Array.isArray(configured)&&!configured.some(option=>String(object(option).name)===String(value)))issues.push(`${name} has an unsupported ${type} option (expected a configured option)`);
        else if(requireConfiguredOption&&!Array.isArray(configured))issues.push(`${name} is missing its configured ${type} options`);
      }
      out[name]={[type]:value===null?null:{name:String(value)}};
    }
    else if(type==="date")out[name]={date:value===null?null:{start:String(value)}};
    else if(type==="relation")out[name]={relation:(value as string[]).map(id=>({id}))};
    else if(type==="number"){if(value!==null&&!Number.isFinite(Number(value))){issues.push(`${name} has a non-numeric value (expected number)`);return;}out[name]={number:value===null?null:Number(value)};}
    else issues.push(`${name} has unsupported type ${type}`);
  }
  const titleName=Object.keys(defs).find(name=>object(defs[name]).type==="title");if(!titleName)issues.push("missing title property (expected title)");
  const a=input.analysis;if(titleName)put([titleName],a.header.title,true);put(["Run ID"],input.runId,true);put(["Company","Companies"],input.companyIds,true);
  put(["Agent"],agents[a.kind]??a.header.agent,true);put(["Status"],a.header.status,true);put(["Analysis Date","Date","Decision Date","Earnings Date"],a.header.date,true);
  put(["Source Freshness"],a.header.sourceFreshness==="fresh"?"Current":a.header.sourceFreshness==="stale"?"Stale":"Unknown");
  // Some production sources keep the summary in the report body rather than a property.
  put(["TL;DR","TLDR","Summary","Executive Summary"],a.summary);
  put(["Verdict","Business Verdict"],a.verdict,a.verdict!==null);put(["Confidence"],a.confidence,a.confidence!==null);
  if(a.kind==="business"||a.kind==="valuation")put(["Score","Business Score"],a.score,a.score!==null);
  if(a.kind==="cio_memo")put(["Handoff Summary"],a.handoffSummary,a.handoffSummary!==null);
  if(a.kind==="decision")for(const [key,value] of Object.entries(a.decision)){
    if(key==="schemaVersion"||value===null)continue;
    const name=key.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase());put([name],value,true);
  }
  if(a.kind==="earnings"){
    const review=a.earningsReview;
    put(["Fiscal Period"],review.fiscalPeriod,review.fiscalPeriod!==null);
    const guidanceName=propertyName(defs,["Guidance"]),guidanceType=guidanceName?String(object(defs[guidanceName]).type):"",guidanceSchema=guidanceName?object(object(defs[guidanceName]).select):{},guidanceOptions=guidanceSchema.options;
    const guidanceValue=review.guidance;
    const knownGuidance=new Set(["Raised","Maintained","Lowered","New","Not Applicable"]);
    if(guidanceValue===null)put(["Guidance"],null);
    else if(guidanceType==="rich_text")put(["Guidance"],guidanceValue,true);
    else if(guidanceType==="select"&&knownGuidance.has(guidanceValue)){
      if(Array.isArray(guidanceOptions)&&guidanceOptions.some(option=>String(object(option).name)===guidanceValue))put(["Guidance"],guidanceValue,true,true);
      else issues.push("Guidance has an unsupported select option (expected a configured option)");
    }else if(guidanceType==="select")put(["Guidance Summary"],guidanceValue,true);
    else if(!guidanceName)put(["Guidance Summary"],guidanceValue,true);
    else issues.push(`Guidance has unsupported type ${guidanceType||"unknown"}`);
    put(["Guidance vs Consensus"],review.guidanceVsConsensus,review.guidanceVsConsensus!==null);
    const refreshOptionByStatus:Record<string,string>={"not-needed":"Not Needed",monitor:"Monitor",recommended:"Recommended",required:"Required"};
    const statusFromRawValue=(rawValue:string|null):string|undefined=>{
      const normalized=(rawValue??"").trim().toLowerCase().replace(/\s+/g," ");
      if(["not needed","no refresh needed","none","up to date"].includes(normalized))return "not-needed";
      if(["monitor","watch"].includes(normalized))return "monitor";
      if(["recommended","refresh recommended"].includes(normalized))return "recommended";
      if(["required","refresh required"].includes(normalized))return "required";
      return undefined;
    };
    for(const refresh of review.refreshes){
      const property=`${refresh.key==="memo"?"Memo":refresh.key[0].toUpperCase()+refresh.key.slice(1)} Refresh`;
      const semanticStatus=refresh.status==="unknown"?statusFromRawValue(refresh.rawValue):refresh.status;
      if(!semanticStatus){if(refresh.rawValue!==null)issues.push(`${property} has an unmappable earnings status`);continue;}
      const option=refreshOptionByStatus[semanticStatus];
      if(!option){issues.push(`${property} has an unmappable earnings status`);continue;}
      put([property],option,true,true);
    }
  }
  return {properties:out,issues:[...new Set(issues)]};
}
/** Preflight a write against a data source schema without any provider call. Empty = compatible. */
export function preflightAnalysisWrite(input:SaveAnalysisInput,schema:RecordValue):string[]{return mapAnalysisProperties(input,schema).issues;}

/** One Notion HTTP client for every writer: bounded reads with backoff, exactly one attempt per mutation. */
export function createNotionClient(options:NotionWriteOptions){
  const requestFetch=options.fetch??fetch;
  const sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  const attempts=Math.max(1,Math.min(options.attempts??3,3))||3;
  async function request(path:string,method="GET",body?:unknown):Promise<RecordValue>{
    if(!options.token.trim())throw fault("dependency");
    if(body!==undefined)validateProviderBody(body);
    let response:Response;
    try{response=await requestFetch(`https://api.notion.com/v1${path}`,{method,headers:{Authorization:`Bearer ${options.token}`,"Notion-Version":"2026-03-11","Content-Type":"application/json"},signal:AbortSignal.timeout(options.timeoutMs??15000),...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch(error){throw fault(["AbortError","TimeoutError"].includes(String(object(error).name))?"timeout":"network");}
    if(!response.ok){
      let rejected:RecordValue={};try{rejected=object(await response.json());}catch{ /* Never log an unparsed response body. */ }
      const knownCodes=["validation_error","invalid_json","invalid_request_url","invalid_request","unauthorized","restricted_resource","object_not_found","conflict_error","rate_limited","internal_server_error","service_unavailable","database_connection_unavailable","service_overload"];
      const structuralKeys=new Set(["body","children","properties","callout","icon","emoji","rich_text","text","content","annotations","type","table","table_row","cells","table_width","has_column_header","has_row_header","heading_1","heading_2","heading_3","paragraph","quote","bulleted_list_item","numbered_list_item","divider","title","relation","select","status","date","number","name","id","parent","data_source_id","start","end"]);
      // Retain structural locators and expected types only, never echoed values or free-form messages.
      const validation=Array.from(String(rejected.message??"").matchAll(/\b(body(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])+)[^\n]*?should be (?:an? )?(object|string|number|boolean|array|undefined|null)\b/g),match=>({
        path:match[1].replace(/[A-Za-z_][A-Za-z0-9_]*/g,key=>structuralKeys.has(key)?key:"redacted"),expected:match[2],
      })).slice(0,20);
      const notionDiagnostic={status:response.status,type:rejected.object==="error"?"error":"unknown",code:knownCodes.includes(String(rejected.code))?String(rejected.code):"unknown",validation};
      console.error("notion_request_rejected",notionDiagnostic);
      options.onDiagnostic?.({code:`notion_${notionDiagnostic.code}`,severity:"error",message:`Notion HTTP ${notionDiagnostic.status}; type=${notionDiagnostic.type}; code=${notionDiagnostic.code}${validation.length?`; ${validation.map(v=>`${v.path}: expected ${v.expected}`).join("; ")}`:""}.`,...(validation[0]?{path:validation[0].path}:{})});
      throw Object.assign(fault(response.status===429?"rate_limit":response.status===404?"not_found":response.status===401?"unauthorized":response.status===403?"forbidden":response.status>=500?"network":"invalid_input"),{notionDiagnostic});
    }
    try{return object(await response.json());}catch{throw fault("network");}
  }
  async function read(path:string,method="GET",body?:unknown){
    for(let n=0;;n++){try{return await request(path,method,body);}catch(error){if(!transient(error)||n+1>=attempts)throw error;await sleep(100*2**n);}}
  }
  async function mutate(path:string,method:string,body:unknown){
    // Lot 12: exactly one provider attempt per mutation, including HTTP 429.
    return request(path,method,body);
  }
  return {read,mutate};
}

export function createNotionAnalysisWriter(db:D1Database,options:NotionWriteOptions){
  const sources={...notionSources,...options.sources};
  const {read,mutate}=createNotionClient(options);
  const page=async(pageId:string)=>await read(`/pages/${pageId}`) as unknown as Page;
  async function children(pageId:string):Promise<RecordValue[]>{
    let cursor:string|undefined;const result:RecordValue[]=[];
    do{const r=await read(`/blocks/${pageId}/children?page_size=100${cursor?`&start_cursor=${encodeURIComponent(cursor)}`:""}`);
      for(const b of Array.isArray(r.results)?r.results:[]){const item=object(b);if(item.has_children===true){const type=String(item.type);item[type]={...object(item[type]),children:await children(String(item.id))};}result.push(item);}
      cursor=r.has_more===true?String(r.next_cursor):undefined;
    }while(cursor);return result;
  }
  async function lookup(source:string,runId:string,moduleAgent:string,runProperty:string):Promise<Page[]>{
    const results:Page[]=[];let cursor:string|undefined;
    do{const r=await read(`/data_sources/${source}/query`,"POST",{filter:{property:runProperty,rich_text:{equals:runId}},page_size:100,...(cursor?{start_cursor:cursor}:{})});results.push(...(Array.isArray(r.results)?r.results:[]) as Page[]);cursor=r.has_more===true?String(r.next_cursor):undefined;}while(cursor);return results.filter(page=>propertyValue(page.properties,"Agent")===moduleAgent);
  }
  function analysisIndexStatements(stored:Page,companies:Page[],sourceKey:string):D1PreparedStatement[]{
    const relationName=propertyName(stored.properties,["Company","Companies"]);
    if(!relationName)throw fault("mapping");
    const now=new Date().toISOString(),pageId=id(stored.id);
    return [
      db.prepare("DELETE FROM notion_document_companies WHERE LOWER(REPLACE(document_page_id,'-',''))=?").bind(pageId),
      db.prepare("DELETE FROM notion_relations WHERE LOWER(REPLACE(source_page_id,'-',''))=? AND property_name=?").bind(pageId,relationName),
      ...companies.flatMap(company=>[
        db.prepare("INSERT INTO notion_document_companies (document_page_id,company_page_id,match_method,matched_at) VALUES (?,?,?,?)").bind(stored.id,company.id,"notion-relation",now),
        db.prepare("INSERT INTO notion_relations (source_page_id,source_key,property_name,target_page_id,target_source_key,matched_at) VALUES (?,?,?,?,?,?)").bind(stored.id,sourceKey,relationName,company.id,"companies",now),
      ]),
    ];
  }
  function currentIndexStatements(companies:Page[],pointers:({name:string}|null)[],sourceKey:string,analysisId:string):D1PreparedStatement[]{
    const now=new Date().toISOString();
    return companies.flatMap((company,n)=>{
      const pointer=pointers[n];if(!pointer)return [];
      return [
        db.prepare("DELETE FROM notion_relations WHERE LOWER(REPLACE(source_page_id,'-',''))=? AND property_name=?").bind(id(company.id),pointer.name),
        db.prepare("INSERT INTO notion_relations (source_page_id,source_key,property_name,target_page_id,target_source_key,matched_at) VALUES (?,?,?,?,?,?)").bind(company.id,"companies",pointer.name,analysisId,sourceKey,now),
      ];
    });
  }
  function mappedProperties(input:SaveAnalysisInput,schema:RecordValue):RecordValue{
    const {properties,issues}=mapAnalysisProperties(input,schema);
    if(issues.length){
      options.onDiagnostic?.({code:"notion_schema_mapping",severity:"error",path:"properties",message:`Notion ${input.analysis.kind} schema mapping failed: ${issues.join("; ")}.`});
      throw fault("mapping");
    }
    return properties;
  }
  function propertiesMatch(actual:Page,expected:RecordValue):boolean{
    return !actual.archived&&!actual.in_trash&&Object.entries(expected).every(([name,value])=>{
      const e=object(value),type=Object.keys(e)[0];
      const actualValue=propertyValue(actual.properties,name);
      if(type==="relation")return equal((actualValue as string[]??[]).map(id).sort(),(e.relation as {id:string}[]).map(v=>id(v.id)).sort());
      if(type==="title"||type==="rich_text")return (actualValue??"")===((e[type] as {text:{content:string}}[]).map(t=>t.text.content).join(""));
      if(type==="select"||type==="status")return actualValue===(e[type]===null?null:object(e[type]).name);
      if(type==="date")return actualValue===(e.date===null?null:object(e.date).start);
      return actualValue===e[type];
    });
  }
  return async function writeAnalysis(input:SaveAnalysisInput):Promise<SaveAnalysisReceipt>{
    if(!isAnalysis(input.analysis)||!input.runId.trim()||(input.expectedRevision!==null&&!uuid(input.analysis.header.id))||!input.companyIds.length||input.companyIds.some(v=>!uuid(v))||new Set(input.companyIds.map(id)).size!==input.companyIds.length||!equal(input.companyIds.map(id).sort(),input.analysis.header.companyIds.map(id).sort())||input.analysis.header.archived)throw fault("invalid_input");
    if(input.analysis.header.sourceKind!==(input.analysis.kind==="decision"?"decision":"analysis")||/superseded|archiv|obsolet|historique|historical|remplac/i.test(input.analysis.header.status))throw fault("invalid_input");
    const family=input.analysis.kind;
    const moduleAgent=agents[family]??input.analysis.header.agent;
    if(!moduleAgent)throw fault("mapping");
    // The production plugin shares one run across modules. Idempotence is scoped to the analysis module.
    const writeKey=JSON.stringify([input.runId,family]);
    const source=family==="decision"?sources.decisions:family==="earnings"?sources.earnings:sources.analyses;
    const schema=await read(`/data_sources/${source}`),expected=mappedProperties(input,schema);
    const summaryInBody=input.analysis.summary!==null&&!propertyName(object(schema.properties),["TL;DR","TLDR","Summary","Executive Summary"]);
    const desiredBlocks=summaryInBody?[
      {object:"block",type:"heading_2",heading_2:{rich_text:text("TL;DR")}},
      {object:"block",type:"paragraph",paragraph:{rich_text:text(input.analysis.summary!)}},
      {object:"block",type:"heading_2",heading_2:{rich_text:text("Rapport complet")}},
      ...blocksFor(input.analysis.content.blocks),
    ]:blocksFor(input.analysis.content.blocks);
    if(new TextEncoder().encode(JSON.stringify(desiredBlocks)).byteLength>450000)throw fault("invalid_input");
    // Preflight all chunks before leasing a journal or performing any provider mutation.
    validateProviderBody({parent:{type:"data_source_id",data_source_id:source},properties:expected,children:desiredBlocks.slice(0,100)});
    for(let start=100;start<desiredBlocks.length;start+=100)validateProviderBody({children:desiredBlocks.slice(start,start+100)});
    const runProperty=propertyName(object(schema.properties),["Run ID"])!;
    const statusName=propertyName(expected,["Status"])!;
    const statusType=Object.keys(object(expected[statusName]))[0];
    const publishing=input.analysis.header.status.toLowerCase()==="validated";
    const draftExpected={...expected,[statusName]:{[statusType]:{name:"Draft"}}};
    // Only properties/body being persisted define compatibility; generated reader provenance is excluded.
    const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonicalJson({source,expected,blocks:desiredBlocks})));
    const digest=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("");
    await db.prepare(`CREATE TABLE IF NOT EXISTS notion_analysis_writes (run_id TEXT PRIMARY KEY,digest TEXT NOT NULL,page_id TEXT,phase TEXT NOT NULL,owner TEXT,lease_until INTEGER NOT NULL DEFAULT 0,previous_current TEXT)`).run();
    await ensureCompanyLinkTable(db);await ensureRelationTable(db);
    const owner=crypto.randomUUID();
    await db.prepare("INSERT INTO notion_analysis_writes(run_id,digest,phase) VALUES(?,?,'new') ON CONFLICT(run_id) DO NOTHING").bind(writeKey,digest).run();
    const journal=await db.prepare("SELECT * FROM notion_analysis_writes WHERE run_id=?").bind(writeKey).first<Journal>();
    if(!journal||journal.digest!==digest)throw fault("stale_request");
    const lease=await db.prepare("UPDATE notion_analysis_writes SET owner=?,lease_until=? WHERE run_id=? AND (owner IS NULL OR lease_until<?)").bind(owner,Date.now()+180000,writeKey,Date.now()).run();
    if(Number(lease.meta?.changes??0)!==1)throw fault("stale_request");
    let analysisId=journal.page_id??input.analysis.header.id,actualIdentityKnown=Boolean(journal.page_id),persisted=false,promoted=false,mutated=false,revision:string|null=null;
    const receipt=(status:SaveAnalysisReceipt["status"],code?:string):SaveAnalysisReceipt=>({schemaVersion:"1.0.0",status,analysisId:id(analysisId),runId:input.runId,revision,persisted,promoted,verified:status==="verified",diagnostics:code?[{code,message:"État relu ou reprise nécessaire; aucune transaction Notion atomique.",severity:status==="verified"?"info":"warning"}]:[]});
    const saveJournal=async(phase:string)=>{
      const result=await db.prepare("UPDATE notion_analysis_writes SET page_id=?,phase=?,lease_until=? WHERE run_id=? AND owner=?").bind(actualIdentityKnown?analysisId:null,phase,Date.now()+180000,writeKey,owner).run();
      if(Number(result.meta?.changes??0)!==1)throw fault("stale_request");
    };
    try{
      const matches=await lookup(source,input.runId,moduleAgent,runProperty);
      if(matches.length>1)throw fault("stale_request");
      let existing=matches[0];
      let matchedBlocks:RecordValue[]|null=null;
      if(existing&&journal.page_id&&id(existing.id)!==id(journal.page_id))throw fault("stale_request");
      if(existing&&input.expectedRevision!==null&&id(existing.id)!==id(input.analysis.header.id))throw fault("stale_request");
      if(existing){
        matchedBlocks=await children(existing.id);
        const actualBlocks=matchedBlocks,desired=desiredBlocks;
        const resumableDraft=journal.phase!=="new"&&propertyValue(existing.properties,"Status")==="Draft"&&actualBlocks.length<desired.length&&blocksMatch(actualBlocks,desired.slice(0,actualBlocks.length));
        if(!(propertiesMatch(existing,expected)||(publishing&&propertiesMatch(existing,draftExpected)))||(!blocksMatch(actualBlocks,desired)&&!resumableDraft))throw fault("stale_request");
      }
      if(journal.page_id&&!existing)throw fault("stale_request");
      if(input.expectedRevision!==null){
        const target=existing??await page(input.analysis.header.id);
        const ownPersisted=existing&&journal.page_id&&id(existing.id)===id(journal.page_id)&&journal.phase!=="new";
        if(target.last_edited_time!==input.expectedRevision&&!ownPersisted)throw fault("stale_request");
      }
      const companies=await Promise.all(input.companyIds.map(page));
      for(const company of companies){if(company.archived||company.in_trash||id(object(company.parent).data_source_id)!==id(sources.companies))throw fault("not_found");}
      const pointers=companies.map(company=>{
        if(!publishing)return null;
        const names=currentProperties[family]??[];const name=propertyName(company.properties,names);
        if(!name||propertyEntry(company.properties,name).type!=="relation"){if(names.length)throw fault("mapping");return null;}
        const ids=(propertyValue(company.properties,name) as string[]??[]).map(id);
        if(ids.length>1)throw fault("mapping");return {company,name,ids};
      });
      if(!existing){
        // An expired lease on an ambiguous create is NOT evidence that Notion did not persist it.
        if(journal.phase!=="new")return receipt("partial","unresolved_create");
        if(input.expectedRevision!==null){
          const target=await page(input.analysis.header.id);
          if(propertyValue(target.properties,"Agent")!==moduleAgent||target.archived||target.in_trash||target.last_edited_time!==input.expectedRevision||id(object(target.parent).data_source_id)!==id(source)||!equal((propertyValue(target.properties,"Company") as string[]??[]).map(id).sort(),input.companyIds.map(id).sort()))throw fault("stale_request");
          // Updating an existing report is allowed only with an unchanged body; content revisions create a new run/page.
          if(!blocksMatch(await children(target.id),desiredBlocks))throw fault("invalid_input");
          analysisId=target.id;actualIdentityKnown=true;await saveJournal("updating");mutated=true;
          try{existing=await mutate(`/pages/${target.id}`,"PATCH",{properties:expected}) as unknown as Page;}
          catch(error){if(!transient(error))throw error;const found=await lookup(source,input.runId,moduleAgent,runProperty);if(found.length!==1)return receipt("partial","update_unconfirmed");existing=found[0];}
        }else{
          await saveJournal("creating");
          mutated=true;
          try{existing=await mutate("/pages","POST",{parent:{type:"data_source_id",data_source_id:source},properties:publishing?draftExpected:expected,children:desiredBlocks.slice(0,100)}) as unknown as Page;}
          catch(error){
            if(["rate_limit","invalid_input","unauthorized","forbidden","not_found"].includes(String(object(error).code))){
              mutated=false;await db.prepare("UPDATE notion_analysis_writes SET phase='new' WHERE run_id=? AND owner=?").bind(writeKey,owner).run();throw error;
            }
            if(!transient(error))throw error;
            const found=await lookup(source,input.runId,moduleAgent,runProperty);if(found.length>1)throw fault("stale_request");if(!found.length)return receipt("partial","create_unconfirmed");existing=found[0];
          }
        }
      }
      analysisId=existing.id;actualIdentityKnown=true;revision=existing.last_edited_time;
      // A new page receives its first 100 blocks in the create request. The final
      // Notion read below verifies them; a partial create is reconciled on replay.
      let observedBlocks=matchedBlocks??(desiredBlocks.length<=100?desiredBlocks:await children(analysisId));
      let appendedPage:Page|null=null;
      if(journal.phase.startsWith("appending:")&&observedBlocks.length<Number(journal.phase.split(":")[1]))return receipt("partial","append_unconfirmed");
      await saveJournal("persisting");
      while(observedBlocks.length<desiredBlocks.length){
        if(!blocksMatch(observedBlocks,desiredBlocks.slice(0,observedBlocks.length)))return receipt("partial","content_changed_concurrently");
        const chunk=desiredBlocks.slice(observedBlocks.length,observedBlocks.length+100);
        const expectedLength=observedBlocks.length+chunk.length;
        await saveJournal(`appending:${expectedLength}`);mutated=true;
        try{await mutate(`/blocks/${analysisId}/children`,"PATCH",{children:chunk});}
        catch(error){
          if(!transient(error))return receipt("partial",String(object(error).code??"append_failed"));
          observedBlocks=await children(analysisId);
          if(observedBlocks.length!==expectedLength||!blocksMatch(observedBlocks,desiredBlocks.slice(0,expectedLength)))return receipt("partial","append_unconfirmed");
        }
        [appendedPage,observedBlocks]=await Promise.all([page(analysisId),children(analysisId)]);
        if(observedBlocks.length!==expectedLength)return receipt("partial","append_unconfirmed");
        await saveJournal("persisting");
      }
      // Persistence certification always uses a fresh GET and complete block re-read.
      let stored:Page;
      let verifiedBlocks:RecordValue[]|null=null;
      if(publishing)stored=await page(analysisId);
      // The last append already obtained a fresh page and complete body read.
      // Reuse that certification for Draft instead of fetching every table again.
      else if(appendedPage){stored=appendedPage;verifiedBlocks=observedBlocks;}
      else [stored,verifiedBlocks]=await Promise.all([page(analysisId),children(analysisId)]);
      if(publishing&&propertiesMatch(stored,draftExpected)&&blocksMatch(await children(analysisId),desiredBlocks)){
        persisted=true;mutated=true;await saveJournal("validating");
        try{await mutate(`/pages/${analysisId}`,"PATCH",{properties:{[statusName]:expected[statusName]}});}
        catch(error){if(!transient(error))throw error;}
        stored=await page(analysisId);
      }
      verifiedBlocks??=await children(analysisId);
      if(id(object(stored.parent).data_source_id)!==id(source)||!propertiesMatch(stored,expected)||!blocksMatch(verifiedBlocks,desiredBlocks))return receipt("partial","persistence_verification_failed");
      persisted=true;revision=stored.last_edited_time;await saveJournal("persisted");
      if(pointers.every(p=>p===null)){
        // The Notion GET above certifies persistence; this D1 projection makes the
        // same Draft immediately available to MCP readback without claiming Current.
        const sourceKey=family==="decision"?"decisions":family==="earnings"?"earnings":"analyses";
        await db.batch([documentUpsertStatement(db,sourceKey,stored as unknown as RecordValue,verifiedBlocks),...analysisIndexStatements(stored,companies,sourceKey)]);
        return receipt("persisted","promotion_not_required");
      }
      const currentBefore=journal.previous_current?JSON.parse(journal.previous_current) as string[][]:pointers.map(p=>p?.ids??[]);
      await db.prepare("UPDATE notion_analysis_writes SET previous_current=?,phase='promoting' WHERE run_id=? AND owner=?").bind(JSON.stringify(currentBefore),writeKey,owner).run();
      for(let n=0;n<pointers.length;n++){
        const pointer=pointers[n];if(!pointer)continue;
        const latest=await page(pointer.company.id),actual=(propertyValue(latest.properties,pointer.name) as string[]??[]).map(id);
        if(equal(actual,[id(analysisId)]))continue;
        if(!equal(actual,currentBefore[n]))return receipt("promotion_pending","current_changed_concurrently");
        await saveJournal("promoting");
        try{await mutate(`/pages/${latest.id}`,"PATCH",{properties:{[pointer.name]:{relation:[{id:analysisId}]}}});}
        catch(error){
          if(transient(error)){const reconciled=await page(latest.id);if(equal((propertyValue(reconciled.properties,pointer.name) as string[]??[]).map(id),[id(analysisId)]))continue;}
          return receipt("promotion_pending",String(object(error).code??"promotion_failed"));
        }
      }
      promoted=true;
      const finalPage=await page(analysisId);
      const finalCompanies=await Promise.all(input.companyIds.map(page));
      const finalPointers=pointers.every((pointer,n)=>{
        const company=finalCompanies[n];
        return !company.archived&&!company.in_trash&&id(object(company.parent).data_source_id)===id(sources.companies)&&(!pointer||equal((propertyValue(company.properties,pointer.name) as string[]??[]).map(id),[id(analysisId)]));
      });
      const finalBlocks=await children(analysisId);
      if(!finalPointers||id(object(finalPage.parent).data_source_id)!==id(source)||!propertiesMatch(finalPage,expected)||!blocksMatch(finalBlocks,desiredBlocks))return receipt("partial","final_verification_failed");
      revision=finalPage.last_edited_time;
      const companySnapshots=await Promise.all(finalCompanies.map(async company=>{
        const cached=await db.prepare("SELECT blocks_json FROM notion_documents WHERE source_key='companies' AND LOWER(REPLACE(page_id,'-',''))=?").bind(id(company.id)).first<{blocks_json:string}>();
        let blocks:RecordValue[]=[];try{const value=JSON.parse(cached?.blocks_json??"[]");if(Array.isArray(value))blocks=value;}catch{ /* preserve only valid cached bodies; this mutation changes properties, not Company content */ }
        return documentUpsertStatement(db,"companies",company as unknown as RecordValue,blocks);
      }));
      const sourceKey=family==="decision"?"decisions":family==="earnings"?"earnings":"analyses";
      await db.batch([
        documentUpsertStatement(db,sourceKey,finalPage as unknown as RecordValue,finalBlocks),
        ...companySnapshots,
        ...analysisIndexStatements(finalPage,finalCompanies,sourceKey),
        ...currentIndexStatements(finalCompanies,pointers,sourceKey,analysisId),
      ]);
      await saveJournal("verified");return receipt("verified");
    }catch(error){if(persisted||promoted||mutated)return receipt("partial",String(object(error).code??"verification_failed"));throw error;}
    finally{await db.prepare("UPDATE notion_analysis_writes SET owner=NULL,lease_until=0 WHERE run_id=? AND owner=?").bind(writeKey,owner).run();}
  };
}
