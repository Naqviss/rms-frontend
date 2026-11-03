import json,sys
d=json.load(open(sys.argv[1]))
S=d['components']['schemas']
def res(s,depth=0,seen=()):
  if depth>4: return '…'
  if '$ref' in s:
    n=s['$ref'].split('/')[-1]
    if n in seen: return n
    return {n:res(S[n],depth+1,seen+(n,))}
  if 'allOf' in s: return [res(x,depth,seen) for x in s['allOf']]
  if s.get('type')=='array': return [res(s['items'],depth,seen)]
  if 'properties' in s:
    req=set(s.get('required',[]))
    return {k+('' if k in req else '?'):res(v,depth+1,seen) for k,v in s['properties'].items()}
  t=s.get('type','?')
  if 'enum' in s: t='|'.join(map(str,s['enum']))
  if s.get('nullable'): t+='|null'
  return t
for spec in sys.argv[2:]:
  m,p=spec.split(' ',1)
  o=d['paths'][p][m.lower()]
  print('=====',m,p,'—',o.get('summary'))
  q=[x['name'] for x in o.get('parameters',[]) if x['in']=='query']
  if q: print('query:',q)
  rb=o.get('requestBody',{}).get('content',{}).get('application/json',{}).get('schema')
  if rb: print('BODY:',json.dumps(res(rb),indent=None))
  for code,r in o.get('responses',{}).items():
    if code.startswith('2'):
      sc=r.get('content',{}).get('application/json',{}).get('schema')
      if sc: print(code,'RESP:',json.dumps(res(sc))[:3000])
