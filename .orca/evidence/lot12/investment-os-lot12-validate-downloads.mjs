import fs from 'node:fs';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
const root='/tmp/investment-os-lot12.ojrzwy';
const require=createRequire(root+'/package.json');
const {build}=require('esbuild');
async function moduleAt(path){const r=await build({entryPoints:[root+'/'+path],bundle:true,write:false,platform:'node',format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
const contract=await moduleAt('core/contracts/analysis.ts');
const {createInvestmentCore}=await moduleAt('core/services/investment-os.ts');
const names=['BUSINESS-MSFT-20261005-save_analysis-draft-intent.json','lot12_lite_reviewable_inline_ed_complete.json','nvda_full_analysis_bundle.json'];
const results=[];
for(const name of names){
 const bytes=fs.readFileSync('/Users/ec/Downloads/'+name),d=JSON.parse(bytes);
 const payloads=d.input?[d]:d.calls?d.calls.map(c=>c.arguments):Object.values(d.payloads);
 const validations=[];
 for(const p of payloads){
  const a=p.input.analysis;let reachedFixturePort=0;
  const core=createInvestmentCore({writeAnalysis:async()=>{reachedFixturePort++;throw {code:'dependency'};}});
  const r=await core.saveAnalysis(p.input);
  const blocks=a.content?.blocks??[];
  validations.push({kind:a.kind,runId:p.input.runId,intentId:a.header.id,companyIds:a.header.companyIds,expectedRevision:p.input.expectedRevision,header:contract.isAnalysisHeader(a.header),content:contract.isAnalysisContent(a.content),canonicalAnalysis:contract.isAnalysis(a),coreInputAccepted:reachedFixturePort===1,coreResult:r.error?.code,blocks:blocks.length,headingCount:blocks.filter(x=>x.type==='heading').length,status:a.header.status,localFixtureOnly:true,notionMutation:false});
 }
 results.push({file:'/Users/ec/Downloads/'+name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),validations});
}
fs.writeFileSync('/tmp/investment-os-lot12-download-validation.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
