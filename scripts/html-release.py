"""One-shot HTML prerelease: bounded checks, no stable rebuild/certification."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import time
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit
import zipfile

REPOSITORY = 'JerryZRic/ai-friends-kart-playcanvas'
VERSION = '1.0.2a'
TAG = 'v' + VERSION
PARENT = 'b665343da013f5cfec0a0f45797adcd347f9607b'
DEV_PARENT = '09c29711d79571848d7b8aa2f902c4c142cae8bc'
EXPECTED_PARENTS = [PARENT, DEV_PARENT]
REQUEST = dict(schemaVersion=1, version=VERSION, expectedParentSha=PARENT, expectedDevParentSha=DEV_PARENT,
               target='html', prerelease=True, latest=False)
ZIP_NAME = f'ai-friends-kart-playcanvas-{TAG}-html.zip'
MANIFEST_NAME = 'RELEASE-MANIFEST.json'
CHECKSUM_ASSETS = [ZIP_NAME, MANIFEST_NAME, 'source.zip']
RELEASE_ASSETS = CHECKSUM_ASSETS + ['SHA256SUMS']
SOURCE_PREFIX = 'ai-friends-kart-playcanvas-source/'
LEGAL = ['LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt',
         'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt']
ROOT_SOURCE = ['.gitignore', 'package.json', 'package-lock.json', 'tsconfig.json',
               'vite.config.ts', 'index.html', 'garage.html', 'coast.html', 'waterpark.html',
               'waterpark-study.html', 'balance-lab.html', *LEGAL]
SOURCE_ROOTS = ['src', 'tests', 'scripts', 'docs', 'models', '.github', 'public']
PAGES = ['index.html', 'garage.html', 'coast.html', 'waterpark.html',
         'waterpark-study.html', 'balance-lab.html', 'source.html']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest_stream(stream):
    result = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(block)
    return result.hexdigest()


def digest(path):
    with Path(path).open('rb') as stream:
        return digest_stream(stream)


def safe_path(name):
    require(isinstance(name, str) and name and '\\' not in name and '\x00' not in name,
            f'Invalid archive path: {name!r}')
    parts = name.split('/')
    require(all(part and part not in ('.', '..') for part in parts), f'Unsafe archive path: {name}')
    require(not PurePosixPath(name).is_absolute() and not re.match(r'^[A-Za-z]:', name),
            f'Absolute archive path: {name}')
    require(not any(part.lower() in ('.git', '.aws', '.codex', '.openai', 'node_modules',
                                    'private', 'secret', 'secrets') for part in parts),
            f'Private path: {name}')
    return name


def inventory(root):
    root = Path(root)
    require(root.is_dir(), f'Missing directory: {root}')
    result = []
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            path = Path(directory) / name
            require(not path.is_symlink(), f'Symlink in publication: {path}')
        for name in files:
            path = Path(directory) / name
            require(path.is_file(), f'Not a regular file: {path}')
            result.append(safe_path(path.relative_to(root).as_posix()))
    return sorted(result)


def zip_members(archive):
    result = {}
    for item in archive.infolist():
        safe_path(item.filename)
        require(not item.is_dir(), f'Unexpected directory member: {item.filename}')
        require(not stat.S_ISLNK(item.external_attr >> 16), f'ZIP symlink: {item.filename}')
        require(not item.flag_bits & 1, f'Encrypted ZIP member: {item.filename}')
        require(item.filename not in result, f'Duplicate ZIP member: {item.filename}')
        result[item.filename] = item
    return result


def command(args):
    return subprocess.check_output(args, text=True).strip()


def runtime_sha():
    sha = os.environ.get('GITHUB_SHA', '')
    require(re.fullmatch('[0-9a-f]{40}', sha), 'GITHUB_SHA must identify an exact commit')
    return sha


def validate_request(request, *, sha, parents, repository, ref, event_name, event):
    require(request == REQUEST, 'Request must be the exact approved HTML-only 1.0.2a prerelease')
    require(re.fullmatch('[0-9a-f]{40}', sha), 'Invalid source SHA')
    require(parents == EXPECTED_PARENTS, 'Merge parents differ from the approved main and dev commits or parent order')
    require(repository == REPOSITORY and ref == 'refs/heads/main', 'Wrong repository or branch')
    require(event_name == 'push', 'Only the explicit main merge push request is supported')
    require(event.get('before') == PARENT and event.get('after') == sha,
            'Push range does not match the exact requested source parent and current commit')


def check_request():
    sha = runtime_sha()
    require(command(['git', 'rev-parse', 'HEAD']) == sha, 'Checkout is not the triggering commit')
    parents = command(['git', 'show', '-s', '--format=%P', 'HEAD']).split()
    require(len(parents) == 2, 'Release source must be the explicit two-parent merge')
    with open(os.environ['GITHUB_EVENT_PATH']) as stream:
        event = json.load(stream)
    with open('docs/html-release-request.json') as stream:
        request = json.load(stream)
    validate_request(request, sha=sha, parents=parents, repository=os.environ.get('GITHUB_REPOSITORY'),
                     ref=os.environ.get('GITHUB_REF'), event_name=os.environ.get('GITHUB_EVENT_NAME'), event=event)
    changed = command(['git', 'diff', '--name-only', parents[0], sha, '--']).splitlines()
    require('docs/html-release-request.json' in changed, 'No explicit request change in this commit')
    print(f'Validated HTML-only prerelease {TAG}: source {sha}; parents {PARENT}, {DEV_PARENT}')


def excluded_source(path):
    return ('__pycache__' in path.split('/') or path.endswith('.pyc') or
            re.match(r'^public/assets/(drivers|portraits)/', path) or
            (path.startswith('public/models/food-karts/') and not path.endswith('/manifest.json')))


def expected_source(root):
    root = Path(root)
    files = list(ROOT_SOURCE)
    files += [path.name for path in root.glob('README*.md') if re.fullmatch(r'README(?:\.[a-zA-Z-]+)?\.md', path.name)]
    for directory in SOURCE_ROOTS:
        files += [directory + '/' + path for path in inventory(root / directory)
                  if not excluded_source(directory + '/' + path)]
    return sorted(set(files))


def verify_source(root, archive_path):
    root = Path(root)
    with zipfile.ZipFile(archive_path) as archive:
        members = zip_members(archive)
        expected = expected_source(root)
        require(sorted(members) == [SOURCE_PREFIX + path for path in expected],
                'Corresponding-source ZIP members differ from the exact approved source set')
        for path in expected:
            require(not excluded_source(path), f'Restricted source asset: {path}')
            require(not path.endswith('.blend') or path in ('models/kart.blend', 'models/props.blend'),
                    f'Unapproved editable model: {path}')
            with archive.open(SOURCE_PREFIX + path) as stream:
                require(digest_stream(stream) == digest(root / path), f'Stale corresponding source: {path}')
    return len(expected)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.has_base = False

    def handle_starttag(self, tag, attrs):
        self.has_base |= tag.lower() == 'base'
        self.links += [(tag.lower(), key.lower(), value) for key, value in attrs
                       if key.lower() in ('src', 'href') and value]


def verify_html_links(contents, files, page):
    parser = Links()
    parser.feed(contents)
    require(not parser.has_base, f'Absolute base override in {page}')
    for tag, attr, href in parser.links:
        if href.startswith(('data:', '#')):
            continue
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc:
            # External source/provenance hyperlinks are documentation, never runtime dependencies.
            require(tag == 'a' and attr == 'href' and parsed.scheme == 'https', f'External dependency in {page}: {href}')
            continue
        require(not href.startswith(('/', '\\')), f'Root-absolute dependency in {page}: {href}')
        for prefix in ('/', '/games/kart/', '/preview/nested/game/'):
            resolved = urlsplit(urljoin('https://example.invalid' + prefix + page, href))
            require(resolved.path.startswith(prefix), f'Escaping subdirectory in {page}: {href}')
            target = unquote(resolved.path[len(prefix):]) or 'index.html'
            require(target in files, f'Missing relative dependency in {page}: {target}')


def verify_dist(root, dist):
    root, dist = Path(root), Path(dist)
    files = inventory(dist)
    public = inventory(root / 'public')
    allowed = set(public + PAGES + LEGAL + ['.nojekyll', 'source.zip'])
    for path in files:
        require(path in allowed or re.fullmatch(r'assets/[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.(?:js|css)(?:\.map)?', path),
                f'Unexpected distribution member: {path}')
    for path in public:
        require(digest(dist / path) == digest(root / 'public' / path), f'Changed public asset: {path}')
    for path in LEGAL:
        require(digest(dist / path) == digest(root / path), f'Missing or altered legal notice: {path}')
    require((dist / '.nojekyll').read_bytes() == b'', 'Invalid .nojekyll')
    for page in PAGES:
        verify_html_links((dist / page).read_text(), set(files), page)
    for manifest in ('docs/runtime-models.json', 'docs/portrait-models.json'):
        records = json.loads((root / manifest).read_text())['assets']
        require(len(records) == 6, 'Expected six driver and six portrait assets')
        for record in records:
            path = dist / safe_path(record['path'])
            require(path.stat().st_size == record['bytes'] and digest(path) == record['sha256'],
                    f'Model hash/size mismatch: {record["path"]}')
    music_dir = dist / 'assets/music'
    require((music_dir / 'LICENSE.txt').is_file() and (music_dir / 'README.txt').is_file(), 'Missing music rights notices')
    for record in json.loads((music_dir / 'inventory.json').read_text()):
        path = music_dir / safe_path(record['name'])
        require(path.stat().st_size == record['size'] and digest(path) == record['sha256'], 'Music hash/size mismatch')
    runtime_js = [path.read_text() for path in (dist / 'assets').glob('*.js')]
    require(any(re.search(r'''(["'`])v?1\.0\.2a\1''', text) for text in runtime_js),
            'Exact quoted release version or badge missing from compiled runtime')
    require(not any(VERSION + '-dev.' in text for text in runtime_js),
            'Dev-labelled JavaScript cannot be published as a release bundle')
    source_count = verify_source(root, dist / 'source.zip')
    return files, source_count


def make_package(root=Path('.'), output=Path('release-html')):
    root, output = Path(root), Path(output)
    sha = runtime_sha()
    files, source_count = verify_dist(root, root / 'dist')
    output.mkdir(parents=True, exist_ok=True)
    require(not list(output.iterdir()), 'Refusing to reuse a nonempty release output directory')
    records = {}
    with zipfile.ZipFile(output / ZIP_NAME, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            source = root / 'dist' / path
            info = zipfile.ZipInfo(path, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            with source.open('rb') as src, archive.open(info, 'w', force_zip64=True) as dest:
                for block in iter(lambda: src.read(1024 * 1024), b''):
                    dest.write(block)
            records[path] = dict(bytes=source.stat().st_size, sha256=digest(source))
    manifest = dict(schemaVersion=1, version=VERSION, tag=TAG, repository=REPOSITORY,
                    sourceCommit=sha, expectedParentSha=PARENT, expectedDevParentSha=DEV_PARENT, channel='release', target='html',
                    prerelease=True, latest=False, sourceFiles=source_count, files=records)
    shutil.copyfile(root / 'dist/source.zip', output / 'source.zip')
    (output / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    (output / 'SHA256SUMS').write_text(''.join(f'{digest(output / name)}  {name}\n' for name in CHECKSUM_ASSETS))
    verify_package(output)
    print(f'Created and verified {ZIP_NAME}: {len(files)} runtime files, {source_count} corresponding-source files')


def verify_package(output=Path('release-html')):
    output = Path(output)
    require(inventory(output) == sorted(RELEASE_ASSETS), 'Unexpected release assets')
    checksums = (output / 'SHA256SUMS').read_text().splitlines()
    require(checksums == [f'{digest(output / name)}  {name}' for name in CHECKSUM_ASSETS], 'Release checksum mismatch')
    manifest = json.loads((output / MANIFEST_NAME).read_text())
    require(all(manifest.get(key) == value for key, value in dict(schemaVersion=1, version=VERSION, tag=TAG,
            repository=REPOSITORY, sourceCommit=runtime_sha(), expectedParentSha=PARENT, expectedDevParentSha=DEV_PARENT,
            channel='release', target='html', prerelease=True, latest=False).items()), 'Release provenance mismatch')
    source = output / 'source.zip'
    require(source.stat().st_size == manifest['files']['source.zip']['bytes'] and
            digest(source) == manifest['files']['source.zip']['sha256'], 'Standalone source archive differs from the HTML bundle source')
    with zipfile.ZipFile(output / ZIP_NAME) as archive:
        members = zip_members(archive)
        require(sorted(members) == sorted(manifest['files']), 'ZIP inventory mismatch')
        for name, item in members.items():
            expected = manifest['files'][name]
            require(item.file_size == expected['bytes'], f'ZIP size mismatch: {name}')
            with archive.open(item) as stream:
                require(digest_stream(stream) == expected['sha256'], f'ZIP hash mismatch: {name}')
    print('Release archive, checksums and exact-commit provenance verified')


def api(path):
    return json.loads(command(['gh', 'api', 'repos/' + REPOSITORY + '/' + path]))


def current_head():
    require(api('git/ref/heads/main')['object']['sha'] == runtime_sha(), 'Main moved; refusing stale release')
    require(api('git/ref/heads/dev')['object']['sha'] == DEV_PARENT, 'Dev moved; refusing publication with an unexpected preview source')


def absent(path):
    result = subprocess.run(['gh', 'api', '--include', 'repos/' + REPOSITORY + '/' + path],
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    require(result.returncode != 0 and re.search(r'^HTTP/\S+ 404\b', result.stdout, re.M),
            f'Cannot prove absence of {path}; refusing to create or overwrite')


def find_release():
    # Listing with Contents:write includes drafts; /releases/tags is only documented for published releases.
    for page in range(1, 101):
        releases = api(f'releases?per_page=100&page={page}')
        matches = [item for item in releases if item['tag_name'] == TAG]
        require(len(matches) <= 1, 'Ambiguous release tag')
        if matches:
            return matches[0]
        if len(releases) < 100:
            return None
    raise ValueError('Release listing exceeded safety bound; cannot prove uniqueness')


def verify_remote(draft):
    current_head()
    ref = api('git/ref/tags/' + TAG)['object']
    require(ref['type'] == 'commit' and ref['sha'] == runtime_sha(), 'Release tag does not target the exact source commit')
    release = find_release()
    require(release is not None, 'Expected release does not exist')
    require(release['tag_name'] == TAG and release['draft'] is draft and release['prerelease'] is True,
            'Release draft/prerelease status mismatch')
    expected = sorted(RELEASE_ASSETS)
    require(sorted(asset['name'] for asset in release['assets']) == expected, 'Uploaded asset inventory mismatch')
    for asset in release['assets']:
        local = Path('release-html') / asset['name']
        require(asset['state'] == 'uploaded' and asset['size'] == local.stat().st_size,
                f'Asset not completely uploaded: {asset["name"]}')
        # GitHub computes this digest from the uploaded bytes; never trust only filenames/sizes.
        require(asset.get('digest') == 'sha256:' + digest(local), f'Uploaded asset hash mismatch: {asset["name"]}')
    print(f'Verified {"draft" if draft else "published"} prerelease: {release["html_url"]}')


class ReleasePending(ValueError):
    pass


def public_source_release(*, expected_sha=None, expected_bytes=None):
    """Read-only gate for Pages: verify a public same-SHA source asset before linking it."""
    current_head()
    release = find_release()
    if release is None or release['draft']:
        raise ReleasePending('Expected public prerelease is not ready')
    require(release['prerelease'] is True, 'Expected a prerelease, not a stable release')
    ref = api('git/ref/tags/' + TAG)['object']
    require(ref['type'] == 'commit' and ref['sha'] == runtime_sha(), 'Public release tag is not this exact main commit')
    assets = release['assets']
    require(sorted(asset['name'] for asset in assets) == sorted(RELEASE_ASSETS), 'Public release asset inventory mismatch')
    for asset in assets:
        require(asset['state'] == 'uploaded' and asset['size'] > 0 and
                re.fullmatch(r'sha256:[0-9a-f]{64}', asset.get('digest') or ''),
                'Public release asset has not completed a verified upload')
    by_name = {asset['name']: asset for asset in assets}
    manifest_asset = by_name[MANIFEST_NAME]
    manifest_bytes = subprocess.check_output(['gh', 'api', '-H', 'Accept: application/octet-stream',
                         f'repos/{REPOSITORY}/releases/assets/{manifest_asset["id"]}'])
    require(len(manifest_bytes) == manifest_asset['size'] and
            'sha256:' + hashlib.sha256(manifest_bytes).hexdigest() == manifest_asset['digest'],
            'Downloaded public release manifest does not match its uploaded digest')
    manifest = json.loads(manifest_bytes)
    require(all(manifest.get(key) == value for key, value in dict(schemaVersion=1, version=VERSION, tag=TAG,
            repository=REPOSITORY, sourceCommit=runtime_sha(), expectedParentSha=PARENT, expectedDevParentSha=DEV_PARENT,
            channel='release', target='html', prerelease=True, latest=False).items()), 'Public source provenance mismatch')
    source = by_name['source.zip']
    record = manifest['files']['source.zip']
    require(source['size'] == record['bytes'] and source['digest'] == 'sha256:' + record['sha256'],
            'Public standalone source does not match the validated corresponding-source archive')
    require(release['html_url'] == f'https://github.com/{REPOSITORY}/releases/tag/{TAG}',
            'Unexpected public release destination')
    expected_url = f'https://github.com/{REPOSITORY}/releases/download/{TAG}/source.zip'
    require(source['browser_download_url'] == expected_url, 'Unexpected public source download destination')
    if expected_sha is not None or expected_bytes is not None:
        require(expected_sha is not None and expected_bytes is not None, 'Both expected source digest and byte size are required')
        require(record['sha256'] == expected_sha and record['bytes'] == expected_bytes,
                'Public source asset differs from this exact Pages build source.zip')
    # GITHUB_TOKEN write access was not needed for this read-only check. The source digest is
    # GitHub's upload digest cross-checked against the exact-commit package manifest.
    return dict(schemaVersion=1, sourceCommit=runtime_sha(), tag=TAG,
                releaseUrl=release['html_url'], sourceUrl=expected_url,
                sourceSha256=record['sha256'], sourceBytes=record['bytes'])


def wait_public(*, expected_sha=None, expected_bytes=None):
    deadline = time.monotonic() + 30 * 60
    while time.monotonic() < deadline:
        try:
            return public_source_release(expected_sha=expected_sha, expected_bytes=expected_bytes)
        except ReleasePending:
            print('Waiting for the public same-SHA HTML/source prerelease...', file=sys.stderr, flush=True)
            time.sleep(15)
    raise ValueError('Timed out waiting for public release; Pages must not deploy a source link yet')


def source_expectation(path=None):
    if path:
        path = Path(path)
        require(path.is_file() and not path.is_symlink(), 'Expected source ZIP must be a regular file')
        return digest(path), path.stat().st_size
    expected_sha = os.environ.get('EXPECTED_SOURCE_SHA256')
    expected_bytes = os.environ.get('EXPECTED_SOURCE_BYTES')
    require(expected_sha is not None and expected_bytes is not None,
            'Provide --source-file or both EXPECTED_SOURCE_SHA256 and EXPECTED_SOURCE_BYTES')
    require(re.fullmatch('[0-9a-f]{64}', expected_sha) and expected_bytes.isdigit() and int(expected_bytes) > 0,
            'Invalid expected source digest or size')
    return expected_sha, int(expected_bytes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['validate-request', 'package', 'verify', 'check-refs', 'check-source-release', 'check-public', 'wait-public', 'preflight', 'verify-draft', 'verify-published'])
    parser.add_argument('--source-file', help='Local exact-build source.zip to verify before linking its public asset')
    args = parser.parse_args()
    action = args.command
    if action == 'validate-request':
        check_request()
    elif action == 'package':
        make_package()
    elif action == 'verify':
        verify_package()
    elif action == 'check-refs':
        current_head()
    elif action in ('check-source-release', 'check-public', 'wait-public'):
        expected_sha, expected_bytes = source_expectation(args.source_file)
        operation = wait_public if action == 'wait-public' else public_source_release
        print(json.dumps(operation(expected_sha=expected_sha, expected_bytes=expected_bytes), sort_keys=True))
    elif action == 'preflight':
        current_head()
        absent('git/ref/tags/' + TAG)
        absent('releases/tags/' + TAG)
        require(find_release() is None, 'An existing draft or release already uses this tag')
    else:
        verify_remote(draft=action == 'verify-draft')


if __name__ == '__main__':
    main()
