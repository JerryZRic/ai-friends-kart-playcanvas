#!/usr/bin/env python3
"""Prepare an exact successor DRAFT from two independently fixed Git inventories.
This tool never approves a change, regenerates a golden, or signs a helper pin.
Both trees must be JSON from GitHub's recursive Git tree endpoint. Every file is
verified against its Git blob ID before use. Review decisions are external input.
"""
import argparse, base64, difflib, hashlib, json, re
from pathlib import Path


BOOTSTRAP=['tests/helpers/post-v100-successor.json','tests/helpers/post-v100-review-pin.ts']
SCOPE={'kind':'complete-git-content-snapshot-excluding-explicit-audit-bootstrap','excludedPaths':BOOTSTRAP}

def sha(data): return hashlib.sha256(data).hexdigest()
def git_blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def git_tree(rows):
    root={}
    for p,row in rows.items():
        node=root
        for part in p.split('/')[:-1]: node=node.setdefault(part,{})
        node[p.split('/')[-1]]=(row['mode'],row['sha'])
    def encode(node):
        parts=[]
        for name,value in sorted(node.items(),key=lambda x:(x[0]+('/' if isinstance(x[1],dict) else '')).encode()):
            mode,digest=('40000',encode(value)) if isinstance(value,dict) else value
            parts.append((mode+' '+name+'\0').encode()+bytes.fromhex(digest))
        body=b''.join(parts)
        return hashlib.sha1(b'tree '+str(len(body)).encode()+b'\0'+body).hexdigest()
    return encode(root)

def inventory(path):
    data=json.loads(Path(path).read_text())
    if data.get('truncated') is not False: raise ValueError('Complete non-truncated Git tree required')
    rows={}
    for row in data['tree']:
        p=row['path']
        if row['type']=='tree': continue
        if row['type']!='blob' or row['mode'] not in ('100644','100755'): raise ValueError('Unsupported object/mode: '+p)
        if p.startswith('/') or '..' in p.split('/') or p in rows: raise ValueError('Invalid or duplicate path: '+p)
        rows[p]=row
    if git_tree(rows)!=data['sha']: raise ValueError('Inventory does not reconstruct declared Git tree')
    return data,rows

def read_verified(root,p,row):
    f=Path(root)/p
    if f.is_symlink(): raise ValueError('Unexpected symlink: '+p)
    if ('100755' if f.stat().st_mode & 0o111 else '100644')!=row['mode']: raise ValueError('Snapshot file mode differs from Git tree: '+p)
    b=f.read_bytes()
    if git_blob(b)!=row['sha']: raise ValueError('Snapshot differs from fixed Git blob: '+p)
    return b

def protected_evidence(p):
    return p.startswith(('tests/fixtures/','docs/scene-baselines/')) or (p.startswith('tests/helpers/') and p.endswith('-transition.json'))

def build(args):
    bt,b=inventory(args.baseline_tree); ct,c=inventory(args.candidate_tree)
    for root,rows in [(args.baseline,b),(args.candidate,c)]:
        actual={str(p.relative_to(root)) for p in Path(root).rglob('*') if p.is_file() and not {'.git','node_modules'}.intersection(p.relative_to(root).parts)}
        if actual!=set(rows): raise ValueError('Snapshot has unlisted additions or missing files')
    decisions=json.loads(Path(args.decisions).read_text())
    if decisions['baselineTree']!=bt['sha'] or decisions['candidateContentTree']!=ct['sha']: raise ValueError('Review bound to wrong snapshot')
    if set(BOOTSTRAP)&set(c): raise ValueError('Content snapshot must precede the two explicit audit bootstrap files')
    changed={p for p in b.keys()|c.keys() if b.get(p)!=c.get(p)}
    # API URLs and metadata do not define bytes; object ID and mode do.
    changed={p for p in changed if p not in b or p not in c or (b[p]['sha'],b[p]['mode'])!=(c[p]['sha'],c[p]['mode'])}
    if set(decisions['paths'])!=changed: raise ValueError('Review decisions must cover EXACT changed and added path set')
    if b.keys()-c.keys(): raise ValueError('Deletion requires separate reviewed protocol: '+str(sorted(b.keys()-c.keys())))
    result={'schema':'post-v100-successor-draft-v1','state':'DRAFT_REVIEW_REQUIRED','baselineTree':bt['sha'],'candidateContentTree':ct['sha'],'inventoryScope':SCOPE,'changes':{},'additions':{},'protectedFiles':{},'protectedModes':{}}
    for p in sorted(c):
        current=read_verified(args.candidate,p,c[p]); previous=read_verified(args.baseline,p,b[p]) if p in b else None
        if p not in changed:
            result['protectedFiles'][p]=sha(current); result['protectedModes'][p]=c[p]['mode']; continue
        d=decisions['paths'][p]
        if protected_evidence(p): raise ValueError('Historical proof cannot be rewritten: '+p)
        if d.get('decision')!='approved' or not d.get('scope') or not isinstance(d.get('evidence'),list) or not d.get('evidence'): raise ValueError('Unapproved or unsupported change: '+p)
        if d.get('currentSha256')!=sha(current) or d.get('previousSha256')!=(sha(previous) if previous is not None else None): raise ValueError('Decision bytes mismatch: '+p)
        behavioral=d.get('behavioralEvidence')
        if 'behavioralEvidenceRequired' in d and not isinstance(d['behavioralEvidenceRequired'],bool): raise ValueError('Behavioral evidence requirement must be boolean: '+p)
        if behavioral is not None and (not isinstance(behavioral,list) or not all(isinstance(item,str) and item.strip() for item in behavioral)): raise ValueError('Behavioral evidence must be explicit references: '+p)
        if d.get('behavioralEvidenceRequired') and not behavioral: raise ValueError('Missing behavioral evidence: '+p)
        row={'currentSha256':sha(current),'scope':d['scope'],'evidence':d['evidence'],'mode':c[p]['mode']}
        for field in ('behavioralEvidenceRequired','behavioralEvidence'):
            if field in d: row[field]=d[field]
        if previous is None:
            result['additions'][p]=row; continue
        if c[p]['mode']!=b[p]['mode']: raise ValueError('Mode change requires separate reviewed protocol: '+p)
        row['previousSha256']=sha(previous); row['previousMode']=b[p]['mode']
        try:
            before=re.findall(r'[^\n]*\n|[^\n]+$',previous.decode('utf-8')); after=re.findall(r'[^\n]*\n|[^\n]+$',current.decode('utf-8'))
        except UnicodeDecodeError:
            # No binary inverse claim: retain exact independently fetched baseline.
            row['kind']='binary'; row['historicalBytesBase64']=base64.b64encode(previous).decode()
        else:
            row['kind']='text'; row['hunks']=[{'beforeStart':i,'afterStart':j,'removedLines':before[i:k],'insertedLines':after[j:l]} for op,i,k,j,l in difflib.SequenceMatcher(None,before,after,autojunk=False).get_opcodes() if op!='equal']
            reconstructed=after[:]
            for h in reversed(row['hunks']):
                j=h['afterStart']; assert reconstructed[j:j+len(h['insertedLines'])]==h['insertedLines']
                reconstructed[j:j+len(h['insertedLines'])]=h['removedLines']
            assert ''.join(reconstructed).encode()==previous
        result['changes'][p]=row
    closures=decisions.get('portableClosures',{})
    if closures and set(closures)!={'airfield','garden'}: raise ValueError('Both portable successor closures require explicit review')
    for scene,closure in closures.items():
        if closure.get('bootstrapDependencies')!=BOOTSTRAP: raise ValueError('Explicit portable bootstrap dependencies required')
        p='docs/'+scene+'-enrichment-qa-files.json'
        if closure.get('historicalManifestSha256')!=result['protectedFiles'].get(p): raise ValueError('Portable historical manifest must remain protected: '+scene)
        if not closure.get('scope') or not closure.get('evidence'): raise ValueError('Closure scope and review evidence required')
        additions=closure.get('additions',[])
        if len(additions)!=len(set(additions)) or any(p not in c for p in additions): raise ValueError('Exact existing portable additions required')
    result['portableClosures']=closures
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for flag in ['baseline','candidate','baseline-tree','candidate-tree','decisions','output']: parser.add_argument('--'+flag,required=True)
    args=parser.parse_args(); result=build(args)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('Exact-inverse draft only. Final independent review and helper pin are still required.')
