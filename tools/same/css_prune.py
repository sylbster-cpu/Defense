# index.html에서 어떤 요소와도 맞을 수 없는 스타일 규칙(또는 선택자 목록의 그 부분)을 지운다. 기준은 css_dead.py.
# python3 tools/same/css_prune.py <게임 폴더> [--write]   --write 없이 돌리면 지울 양만 알려 준다. 지운 뒤에는 ui.js로 화면이 같은지 확인한다
import re,sys
sys.argv=[sys.argv[0]]+sys.argv[1:]
ROOT=sys.argv[1];WRITE='--write' in sys.argv
import importlib.util
spec=importlib.util.spec_from_file_location('css_dead',__file__.replace('css_prune.py','css_dead.py'));
_argv=sys.argv;sys.argv=[_argv[0],ROOT];cd=importlib.util.module_from_spec(spec);spec.loader.exec_module(cd);sys.argv=_argv
EXTRA=[re.compile(r'data-screen="finish"\]\s*>\s*\.tiny')]     # the finish screen has no .tiny line any more
def dead(part):
    r=cd.dead_part(part)
    if r:return r
    for e in EXTRA:
        if e.search(part):return 'no such element'
    return ''
html=open(ROOT+'/index.html',encoding='utf8').read()
a=html.index('<style>')+7;b=html.index('</style>');css=html[a:b]
stats={'rules':0,'removed':0,'trimmed':0,'parts':0,'media':0}
def parse(text,i=0,depth=0):
    """returns (new_text, next_index) for the block starting at i (until the matching '}' when depth>0)"""
    out=[];n=len(text)
    while i<n:
        ch=text[i]
        if text.startswith('/*',i):
            j=text.index('*/',i)+2;out.append(text[i:j]);i=j;continue
        if ch=='}':
            if depth>0:return ''.join(out),i
            out.append(ch);i+=1;continue
        if ch.isspace():out.append(ch);i+=1;continue
        # a prelude up to '{'
        j=i;d=0
        while j<n:
            c=text[j]
            if c in '([':d+=1
            elif c in ')]':d-=1
            elif c=='"' or c=="'":
                k=text.index(c,j+1);j=k
            elif c=='{' and d==0:break
            j+=1
        prelude=text[i:j]
        if prelude.lstrip().startswith('@media'):
            inner,k=parse(text,j+1,depth+1)
            if inner.strip()=='':stats['media']+=1          # nothing left inside: the whole block goes
            else:out.append(prelude+'{'+inner+'}')
            i=k+1;continue
        # any other block: find its end (keyframes nest one level)
        k=j+1;d=1
        while d>0:
            c=text[k]
            if c=='{':d+=1
            elif c=='}':d-=1
            elif c=='"' or c=="'":k=text.index(c,k+1)
            k+=1
        blockbody=text[j:k]
        if prelude.lstrip().startswith('@'):out.append(prelude+blockbody);i=k;continue
        stats['rules']+=1
        parts=cd.split_top(prelude);keep=[p for p in parts if not dead(p)]
        stats['parts']+=len(parts)-len(keep)
        if not keep:stats['removed']+=1
        elif len(keep)<len(parts):stats['trimmed']+=1;out.append(','.join(p.strip() for p in keep)+blockbody)
        else:out.append(prelude+blockbody)
        i=k
    return ''.join(out),i
new,_=parse(css)
# lines left with nothing but spaces go; so do comment lines that introduced only removed rules (reviewed by hand afterwards)
lines=[l for l in new.split('\n')]
new='\n'.join(l for l in lines if l.strip()!='' )
if not new.startswith('\n'):new='\n'+new
if not new.endswith('\n'):new+='\n'
print(stats,'css bytes',len(css.encode()),'->',len(new.encode()))
if WRITE:open(ROOT+'/index.html','w',encoding='utf8').write(html[:a]+new+html[b:]);print('written')
