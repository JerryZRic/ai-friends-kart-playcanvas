"""Small CPU/filesystem release-contract tests; no network or browser access."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

SPEC = importlib.util.spec_from_file_location('html_release', Path(__file__).resolve().parents[1] / 'scripts/html-release.py')
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
SHA = 'a' * 40


class HtmlReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, GITHUB_SHA=SHA)
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def write(self, path, value):
        path = self.root / path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value if isinstance(value, bytes) else value.encode())
        return path

    def source_zip(self):
        with zipfile.ZipFile(self.root / 'dist/source.zip', 'w') as archive:
            for path in release.expected_source(self.root):
                archive.write(self.root / path, release.SOURCE_PREFIX + path)

    def fixture(self):
        for path in release.ROOT_SOURCE:
            self.write(path, 'source or legal notice: ' + path)
        self.write('README.md', 'Build instructions')
        for directory in release.SOURCE_ROOTS:
            self.write(directory + '/fixture.txt', 'Original source fixture')
        for directory, manifest in [('drivers', 'runtime-models'), ('portraits', 'portrait-models')]:
            records = []
            for index in range(6):
                path = f'assets/{directory}/fixture{index}.glb.gz'
                file = self.write('public/' + path, f'{directory} runtime {index}')
                records.append(dict(path=path, bytes=file.stat().st_size, sha256=release.digest(file)))
            self.write('docs/' + manifest + '.json', json.dumps(dict(assets=records)))
        file = self.write('public/assets/music/theme.mp3', 'music fixture')
        self.write('public/assets/music/inventory.json', json.dumps([dict(name='theme.mp3', size=file.stat().st_size, sha256=release.digest(file))]))
        self.write('public/assets/music/LICENSE.txt', 'Separate rights')
        self.write('public/assets/music/README.txt', 'Music provenance')
        self.write('public/models/food-karts/manifest.json', '{}')
        self.write('public/models/food-karts/payload.bin', 'separate food payload')
        self.write('public/source.html', '<a href="./">Back</a><a href="source.zip">Source</a>')
        shutil.copytree(self.root / 'public', self.root / 'dist')
        for path in release.PAGES[:-1]:
            self.write('dist/' + path, '<script type="module" src="./assets/main-abc.js"></script><link href="./assets/main-abc.css" rel="stylesheet"><a href="source.html">License</a>')
        for path in release.LEGAL:
            shutil.copy(self.root / path, self.root / 'dist' / path)
        self.write('dist/assets/main-abc.js', 'const version="1.0.2a";')
        self.write('dist/assets/main-abc.css', 'body{color:white}')
        self.write('dist/.nojekyll', '')
        self.source_zip()

    def test_exact_request_and_wrong_version_parent_branch_and_push_fail_closed(self):
        arguments = dict(sha=SHA, parents=release.EXPECTED_PARENTS, repository=release.REPOSITORY,
                         ref='refs/heads/main', event_name='push', event=dict(before=release.PARENT, after=SHA))
        release.validate_request(release.REQUEST, **arguments)
        for key, value in [('version', '1.0.2'), ('target', 'windows'), ('prerelease', False), ('latest', True), ('expectedParentSha', SHA), ('expectedDevParentSha', SHA)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.validate_request({**release.REQUEST, key: value}, **arguments)
        for key, value in [('parents', [SHA, release.DEV_PARENT]), ('parents', list(reversed(release.EXPECTED_PARENTS))), ('parents', [release.PARENT]), ('ref', 'refs/heads/dev'), ('repository', 'other/repository'), ('event_name', 'workflow_dispatch'), ('event', dict(before=SHA, after=SHA))]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.validate_request(release.REQUEST, **{**arguments, key: value})

    def test_safe_paths_reject_escape_backslash_private_and_drive_paths(self):
        for path in ['../x', '/x', 'a/../x', 'a//x', 'a\\x', 'C:/x', '.git/config', 'private/x', 'x\x00y']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                release.safe_path(path)
        self.assertEqual(release.safe_path('.github/workflows/release.yml'), '.github/workflows/release.yml')

    def test_zip_rejects_duplicates_and_symlinks(self):
        path = self.root / 'unsafe.zip'
        with warnings.catch_warnings(), zipfile.ZipFile(path, 'w') as archive:
            warnings.simplefilter('ignore')
            archive.writestr('index.html', 'first')
            archive.writestr('index.html', 'duplicate')
        with zipfile.ZipFile(path) as archive, self.assertRaisesRegex(ValueError, 'Duplicate'):
            release.zip_members(archive)
        with zipfile.ZipFile(path, 'w') as archive:
            link = zipfile.ZipInfo('link')
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(link, 'outside')
        with zipfile.ZipFile(path) as archive, self.assertRaisesRegex(ValueError, 'symlink'):
            release.zip_members(archive)

    def test_links_work_at_root_and_nested_and_reject_absolute_or_missing(self):
        files = {'index.html', 'assets/app.js', 'source.html'}
        release.verify_html_links('<script src="./assets/app.js?v=1"></script><a href="./">Back</a>', files, 'index.html')
        for html in ['<script src="/assets/app.js"></script>', '<script src="https://cdn.invalid/app.js"></script>', '<a href="../index.html">Bad</a>', '<script src="missing.js"></script>', '<base href="/">']:
            with self.subTest(html=html), self.assertRaises(ValueError):
                release.verify_html_links(html, files, 'index.html')

    def test_complete_package_has_root_layout_legal_source_and_runtime_rights(self):
        self.fixture()
        output = self.root / 'output'
        release.make_package(self.root, output)
        release.verify_package(output)
        with zipfile.ZipFile(output / release.ZIP_NAME) as archive:
            self.assertIn('index.html', archive.namelist())
            self.assertIn('source.zip', archive.namelist())
            self.assertIn('assets/music/LICENSE.txt', archive.namelist())
            self.assertIn('assets/drivers/fixture0.glb.gz', archive.namelist())
        with zipfile.ZipFile(self.root / 'dist/source.zip') as source:
            self.assertNotIn(release.SOURCE_PREFIX + 'public/assets/drivers/fixture0.glb.gz', source.namelist())
            self.assertNotIn(release.SOURCE_PREFIX + 'public/models/food-karts/payload.bin', source.namelist())
            self.assertIn(release.SOURCE_PREFIX + 'public/models/food-karts/manifest.json', source.namelist())
        with self.assertRaisesRegex(ValueError, 'nonempty'):
            release.make_package(self.root, output)
        (output / 'SHA256SUMS').write_text('tampered')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            release.verify_package(output)

    def test_missing_music_notice_changed_asset_stale_source_and_unexpected_executable_fail(self):
        self.fixture()
        music = self.root / 'dist/assets/music/LICENSE.txt'
        original = music.read_bytes()
        music.unlink()
        with self.assertRaises((ValueError, FileNotFoundError)):
            release.verify_dist(self.root, self.root / 'dist')
        music.write_bytes(original)
        self.write('dist/unrequested.exe', b'EXE')
        with self.assertRaisesRegex(ValueError, 'Unexpected distribution'):
            release.verify_dist(self.root, self.root / 'dist')
        (self.root / 'dist/unrequested.exe').unlink()
        self.write('src/fixture.txt', 'unpackaged new source')
        with self.assertRaisesRegex(ValueError, 'Stale corresponding source'):
            release.verify_dist(self.root, self.root / 'dist')

    def test_production_constant_folded_badge_retains_exact_release_identity(self):
        self.fixture()
        self.write('dist/assets/main-abc.js', 'label.textContent="v1.0.2a";label.setAttribute("aria-label","游戏版本 1.0.2a");')
        files, source_count = release.verify_dist(self.root, self.root / 'dist')
        self.assertIn('assets/main-abc.js', files)
        self.assertGreater(source_count, 0)
        self.write('dist/assets/main-abc.js', 'label.textContent="v1.0.2a-dev.abcdef";')
        with self.assertRaisesRegex(ValueError, 'Exact quoted release version'):
            release.verify_dist(self.root, self.root / 'dist')

    def test_actual_vite_backtick_identity_and_strict_wrong_version_rejection(self):
        self.fixture()
        for delimiter in ['"', "'", '`']:
            for prefix in ['', 'v']:
                self.write('dist/assets/main-abc.js', f'var a={delimiter}{prefix}1.0.2a{delimiter};function o(){{return a;}}')
                release.verify_dist(self.root, self.root / 'dist')
        for version in ['1.0.2', '1.0.2b', '1.0.2ab', '1.0.2a-dev.abcdef', '1.0.2a${suffix}', 'v1.0.2a-dev.abcdef']:
            with self.subTest(version=version):
                self.write('dist/assets/main-abc.js', f'var a=`{version}`;function o(){{return a;}}')
                with self.assertRaisesRegex(ValueError, 'Exact quoted release version'):
                    release.verify_dist(self.root, self.root / 'dist')

    def test_dev_label_is_rejected_even_when_release_literal_also_exists(self):
        self.fixture()
        self.write('dist/assets/main-abc.js', 'const version="1.0.2a-dev.abcdef";')
        with self.assertRaisesRegex(ValueError, 'Exact quoted release version'):
            release.verify_dist(self.root, self.root / 'dist')
        self.write('dist/assets/main-abc.js', 'const version="1.0.2a", stale="1.0.2a-dev.abcdef";')
        with self.assertRaisesRegex(ValueError, 'Dev-labelled'):
            release.verify_dist(self.root, self.root / 'dist')

    def test_archive_checksum_provenance_detects_different_commit(self):
        self.fixture()
        output = self.root / 'output'
        release.make_package(self.root, output)
        with patch.dict(os.environ, GITHUB_SHA='b' * 40), self.assertRaisesRegex(ValueError, 'provenance'):
            release.verify_package(output)

    def test_ref_guards_reject_main_or_dev_movement(self):
        with patch.object(release, 'api', side_effect=[dict(object=dict(sha=SHA)), dict(object=dict(sha=release.DEV_PARENT))]):
            release.current_head()
        with patch.object(release, 'api', return_value=dict(object=dict(sha='b' * 40))), self.assertRaisesRegex(ValueError, 'Main moved'):
            release.current_head()
        with patch.object(release, 'api', side_effect=[dict(object=dict(sha=SHA)), dict(object=dict(sha='b' * 40))]), self.assertRaisesRegex(ValueError, 'Dev moved'):
            release.current_head()

    def test_standalone_source_is_byte_identical_and_checksummed(self):
        self.fixture()
        output = self.root / 'output'
        release.make_package(self.root, output)
        self.assertEqual((output / 'source.zip').read_bytes(), (self.root / 'dist/source.zip').read_bytes())
        self.assertIn(release.digest(output / 'source.zip') + '  source.zip', (output / 'SHA256SUMS').read_text())
        self.assertEqual(len(list(output.iterdir())), 4)

    def test_public_source_gate_checks_manifest_uploaded_source_and_local_expected_bytes(self):
        self.fixture()
        output = self.root / 'output'
        release.make_package(self.root, output)
        assets = [dict(id=index, name=name, size=(output / name).stat().st_size,
                       digest='sha256:' + release.digest(output / name), state='uploaded',
                       browser_download_url=f'https://github.com/{release.REPOSITORY}/releases/download/{release.TAG}/{name}')
                  for index, name in enumerate(release.RELEASE_ASSETS, 1)]
        public = dict(tag_name=release.TAG, draft=False, prerelease=True, assets=assets,
                      html_url=f'https://github.com/{release.REPOSITORY}/releases/tag/{release.TAG}')
        def api(path):
            if path == 'git/ref/heads/main': return dict(object=dict(sha=SHA))
            if path == 'git/ref/heads/dev': return dict(object=dict(sha=release.DEV_PARENT))
            if path.startswith('releases?'): return [public]
            if path == 'git/ref/tags/' + release.TAG: return dict(object=dict(type='commit', sha=SHA))
            raise AssertionError('Unexpected API path: ' + path)
        expected_sha = release.digest(output / 'source.zip')
        expected_bytes = (output / 'source.zip').stat().st_size
        with patch.object(release, 'api', side_effect=api), patch.object(release.subprocess, 'check_output', return_value=(output / release.MANIFEST_NAME).read_bytes()):
            proof = release.public_source_release(expected_sha=expected_sha, expected_bytes=expected_bytes)
            self.assertEqual(proof['sourceSha256'], expected_sha)
            self.assertEqual(proof['sourceBytes'], expected_bytes)
            with self.assertRaisesRegex(ValueError, 'differs from this exact Pages build'):
                release.public_source_release(expected_sha='0' * 64, expected_bytes=expected_bytes)
            assets[2]['digest'] = 'sha256:' + '0' * 64
            with self.assertRaisesRegex(ValueError, 'standalone source'):
                release.public_source_release(expected_sha=expected_sha, expected_bytes=expected_bytes)
            assets[2]['digest'] = 'sha256:' + expected_sha
            public['draft'] = True
            with self.assertRaises(release.ReleasePending):
                release.public_source_release(expected_sha=expected_sha, expected_bytes=expected_bytes)

    def test_wait_public_retries_only_pending_and_source_expectation_is_explicit(self):
        proof = dict(sourceCommit=SHA)
        with patch.object(release, 'public_source_release', side_effect=[release.ReleasePending('not ready'), proof]), patch.object(release.time, 'sleep') as sleep:
            self.assertEqual(release.wait_public(expected_sha='a' * 64, expected_bytes=1), proof)
            sleep.assert_called_once_with(15)
        with patch.object(release, 'public_source_release', side_effect=ValueError('bad digest')), patch.object(release.time, 'sleep') as sleep, self.assertRaisesRegex(ValueError, 'bad digest'):
            release.wait_public(expected_sha='a' * 64, expected_bytes=1)
            sleep.assert_not_called()
        with patch.dict(os.environ, EXPECTED_SOURCE_SHA256='a' * 64, EXPECTED_SOURCE_BYTES='123'):
            self.assertEqual(release.source_expectation(), ('a' * 64, 123))
        with patch.dict(os.environ, EXPECTED_SOURCE_SHA256='bad', EXPECTED_SOURCE_BYTES='123'), self.assertRaises(ValueError):
            release.source_expectation()

    def test_workflow_requires_main_merge_without_windows_full_test_or_shared_pages_lock(self):
        workflow = (Path(__file__).resolve().parents[1] / '.github/workflows/release-html.yml').read_text()
        for expected in ['branches: [main]', 'paths: [docs/html-release-request.json]', 'GAME_BUILD_CHANNEL: release', 'DEV_BUILD_SHA: ${{ github.sha }}', 'group: html-prerelease', '--draft --prerelease --latest=false', '--verify-tag', 'python3 scripts/html-release.py verify-draft']:
            self.assertIn(expected, workflow)
        for forbidden in ['windows-latest', 'npm test', 'npm run test:dist', 'pages: write', 'actions: write', 'group: github-pages', 'branches: [dev]', 'wait-pages', 'check-pages']:
            self.assertNotIn(forbidden, workflow)
        self.assertLess(workflow.index('python3 scripts/html-release.py verify-draft'), workflow.index('gh release edit'))
        self.assertLess(workflow.index('python3 scripts/html-release.py check-refs'), workflow.index('gh release edit'))


if __name__ == '__main__':
    unittest.main()
