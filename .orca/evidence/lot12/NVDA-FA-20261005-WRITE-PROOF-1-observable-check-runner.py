from pathlib import Path
import json,re,html
p=Path('/Users/ec/orca/workspaces/investment-os-stabilization/hawkfish/.orca/evidence/lot12');run='NVDA-FA-20261005-WRITE-PROOF-1'
a=json.loads((p/f'{run}-business-save-arguments.json').read_text());raw=json.loads((p/f'{run}-notion-readback.json').read_text());n=json.loads(raw['content'][0]['text']);doc=n['text'];props=json.loads(doc.split('<properties>\n',1)[1].split('\n</properties>',1)[0]);body=doc.split('<content>\n',1)[1].split('\n</content>',1)[0]
def normalize(s):
 s=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',r'\1',s)
 return ' '.join(html.unescape(re.sub(r'\\([\\`*_{}\[\]()#+\-.!<>~$])',r'\1',s)).split())
normal=normalize(body);segments=[]
for b in a['input']['analysis']['content']['blocks']:
 if b['type'] in ['heading','paragraph','quote','callout']:groups=[b['text']]
 elif b['type']=='list':groups=b['items']
 elif b['type']=='table':groups=[cell for row in b['rows'] for cell in row]
 else:groups=[]
 for g in groups:segments.append({'blockId':b['id'],'text':''.join(v['text'] for v in g)})
missing=[{'blockId':x['blockId'],'text':x['text']} for x in segments if normalize(x['text']) not in normal]
r={'notionPageId':'3f037ea7af3581a2acfbc17bc6c1e29d','notionAnalysisId':props['Analysis ID'],'status':props['Status'],'runId':props['Run ID'],'company':props['Company'],'score':props['Score'],'verdict':props['Verdict'],'summaryPresent':normalize(a['input']['analysis']['summary']) in normal,'textSegmentsChecked':len(segments),'missingTextSegments':missing,'normalizedTextCoverage':not missing,'calloutIconObserved':'💡' if '<callout icon="💡">' in body else None,'calloutIconExpectedAbsent':True,'comparisonLimit':'Notion connector document, not raw REST blocks. Text inclusion does not prove block order/IDs/annotations or complete DTO equality. Missing matches may reflect connector formatting.','canonicalMcpReadback':None,'receiptPersisted':False,'receiptVerified':False,'notionObservablePersistence':True}
assert props['Status']=='Draft' and props['Run ID']==run and props['Score']==92 and props['Verdict']=='Excellent';assert props['Company']==['https://app.notion.com/p/3b337ea7af35811eb7e5e934f832c389']
(p/f'{run}-observable-verification.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in r.items() if k!='missingTextSegments'},ensure_ascii=False,indent=2));print('missing segments:',len(missing))
