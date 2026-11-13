# 스타일 규칙 가운데 어떤 요소와도 맞을 수 없는 선택자를 찾는다: 마크업, 스크립트가 만드는 HTML, classList 호출 어디에도 없는 클래스나 id를 가리키는 것.
# python3 tools/same/css_dead.py <게임 폴더> [css_census.js의 결과.json]   결과 파일을 주면 실제 화면 조사와 맞는지도 대조한다
import re,json,sys
ROOT=sys.argv[1]
html=open(ROOT+'/index.html',encoding='utf8').read()
a=html.index('<style>');b=html.index('</style>');css=html[a+7:b];body=html[b:]
js=body[body.index('<script>'):]
markup=body[:body.index('<script src')]
classes=set();ids=set()
for m in re.finditer(r'class="([^"]*)"',markup):classes.update(m.group(1).split())
for m in re.finditer(r'id="([^"]*)"',markup):ids.add(m.group(1))
# html built in scripts: every word inside a class="..." attribute, including the pieces of expressions
for m in re.finditer(r'class=\\?"(.*?)\\?"[ >]',js):
    v=m.group(1);expr=re.findall(r"\$\{.*?\}|'\+.*?\+'",v);plain=re.sub(r"\$\{.*?\}|'\+.*?\+'"," ",v)
    classes.update(re.findall(r"[A-Za-z_][A-Za-z0-9_-]*",plain))          # the fixed words of the attribute
    for e in expr:classes.update(re.findall(r"'([A-Za-z0-9_-]+)'",e))    # and the quoted words an expression can put there
for m in re.finditer(r"classList\.(?:add|remove|toggle)\(([^)]*)\)",js):classes.update(re.findall(r"'([A-Za-z0-9_-]+)'",m.group(1)))
for m in re.finditer(r'id=\\?"([A-Za-z0-9_-]+)\\?"',js):ids.add(m.group(1))
for f in ['core','env','maps','base','units','fx','hud']:
    t=open(ROOT+'/r3d/'+f+'.js',encoding='utf8').read()
    for m in re.finditer(r"className=(?:[A-Za-z.]+=)?'([^']*)'",t):classes.update(m.group(1).split())
    for m in re.finditer(r"\.id='([^']*)'",t):ids.add(m.group(1))
    for m in re.finditer(r"classList\.(?:add|remove|toggle)\(([^)]*)\)",t):classes.update(re.findall(r"'([A-Za-z0-9_-]+)'",m.group(1)))
def split_top(s):
    out=[];d=0;cur=''
    for ch in s:
        if ch in '([':d+=1
        if ch in ')]':d-=1
        if ch==','and d==0:out.append(cur);cur=''
        else:cur+=ch
    out.append(cur);return out
def dead_part(part):
    p=re.sub(r'\[[^\]]*\]','',part)
    for m in re.finditer(r'\.([A-Za-z_][A-Za-z0-9_-]*)',p):
        if m.group(1) not in classes:return 'class '+m.group(1)
    for m in re.finditer(r'#([A-Za-z_][A-Za-z0-9_-]*)',p):
        if m.group(1) not in ids:return 'id '+m.group(1)
    return ''
if __name__=='__main__':
    print('classes that exist:',len(classes),' ids:',len(ids))
    print(' '.join(sorted(classes)))
    cen=json.load(open(sys.argv[2])) if len(sys.argv)>2 else []
    never=[r for r in cen if not r['n']]
    flagged=[r for r in cen if dead_part(r['part'])]
    wrong=[r for r in flagged if r['n']]
    print('census parts',len(cen),'never matched',len(never),'statically dead',len(flagged),'dead but matched somewhere (must be 0):',len(wrong))
    for r in wrong[:10]:print('  !!',r['part'],r['where'])
    rest=[r for r in never if not dead_part(r['part'])]
    print('never matched but not statically dead:',len(rest))
    for r in rest:print('  ',(r['ctx'][:38]+' | ' if r['ctx'] else '')+r['part'])
