"""Retrieve an immutable, digest-pinned GitHub Pages snapshot; reject unsafe entries."""
import hashlib,json,pathlib,subprocess,tarfile,zipfile
c=json.loads(pathlib.Path('docs/pages-snapshot.json').read_text())
assert c['repository']=='JerryZRic/ai-friends-kart-playcanvas'
artifact=c['baseline']['artifactId']; assert isinstance(artifact,int) and artifact>0
archive=pathlib.Path('baseline-pages.zip')
with archive.open('wb') as out: subprocess.run(['gh','api',f"repos/{c['repository']}/actions/artifacts/{artifact}/zip"],stdout=out,check=True)
with archive.open('rb') as data: digest=hashlib.file_digest(data,'sha256').hexdigest()
assert 'sha256:'+digest==c['baseline']['artifactDigest'],'Artifact digest mismatch'
with zipfile.ZipFile(archive) as z:
    assert z.namelist()==['artifact.tar'],'Unexpected Pages archive payload'
    z.extract('artifact.tar','baseline-archive')
with tarfile.open('baseline-archive/artifact.tar') as archive:
    for entry in archive.getmembers():
        p=pathlib.PurePosixPath(entry.name)
        assert not p.is_absolute() and '..' not in p.parts,entry.name
        assert entry.isfile() or entry.isdir(),entry.name
    assert not pathlib.Path('baseline-pages').exists()
    archive.extractall('baseline-pages',filter='data')
print('Pinned Pages snapshot downloaded, digest verified and safely extracted')
