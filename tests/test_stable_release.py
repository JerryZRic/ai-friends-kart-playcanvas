import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stable_release', ROOT / 'scripts/stable-release.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
SHA = 'a' * 40
RC = 'b' * 40


class RequestTests(unittest.TestCase):
    def args(self, main=True):
        return dict(sha=SHA, parents=[r.PARENT, RC] if main else [r.DEV_PARENT],
                    repository=r.REPOSITORY, ref='refs/heads/main' if main else 'refs/heads/' + r.CERT_BRANCH,
                    event_name='push', event=dict(before=r.PARENT, after=SHA))

    def test_exact_request(self):
        self.assertEqual(json.loads((ROOT / r.REQUEST_PATH).read_text()), r.REQUEST)
        r.validate_request(r.REQUEST, **self.args())
        r.validate_request(r.REQUEST, **self.args(False))

    def test_mutated_request_rejected(self):
        for key in r.REQUEST:
            with self.subTest(key=key), self.assertRaises(ValueError):
                r.validate_request({**r.REQUEST, key: None}, **self.args())

    def test_wrong_context_rejected(self):
        for key, value in [('sha', 'main'), ('parents', [r.PARENT]), ('parents', [RC, r.PARENT]),
                           ('repository', 'other/repo'), ('ref', 'refs/heads/dev'), ('event_name', 'workflow_dispatch'),
                           ('event', dict(before=RC, after=SHA)), ('event', dict(before=r.PARENT, after=RC))]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                r.validate_request(r.REQUEST, **{**self.args(), key: value})

    def test_all_release_assets_and_stable(self):
        self.assertEqual(len(r.RELEASE_ASSETS), 5)
        self.assertIn(r.WINDOWS_NAME, r.RELEASE_ASSETS)
        self.assertFalse(r.REQUEST['prerelease'])
        self.assertTrue(r.REQUEST['latest'])

    def test_main_requires_matching_tree_and_successful_candidate(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'docs').mkdir()
            (root / r.REQUEST_PATH).write_text(json.dumps(r.REQUEST))
            (root / 'package.json').write_text(json.dumps(dict(version=r.VERSION)))
            event = root / 'event.json'
            event.write_text(json.dumps(dict(before=r.PARENT, after=SHA)))
            old = Path.cwd()
            os.chdir(root)
            try:
                def command(args):
                    if args == ['git', 'rev-parse', 'HEAD']: return SHA
                    if args[:3] == ['git', 'show', '-s']: return r.PARENT + ' ' + RC
                    if args[:3] == ['git', 'diff', '--name-only']: return r.REQUEST_PATH
                    if args[:2] == ['git', 'rev-parse']: return 'same-tree'
                    raise AssertionError(args)
                run = dict(head_sha=RC, head_branch=r.CERT_BRANCH, event='push', status='completed', conclusion='success')
                with patch.dict(os.environ, GITHUB_SHA=SHA, GITHUB_EVENT_PATH=str(event),
                                GITHUB_REPOSITORY=r.REPOSITORY, GITHUB_REF='refs/heads/main', GITHUB_EVENT_NAME='push'), \
                     patch.object(r, 'command', side_effect=command), \
                     patch.object(r.subprocess, 'run', return_value=SimpleNamespace(returncode=0)), \
                     patch.object(r, 'api', return_value={'workflow_runs': [run]}) as api:
                    r.check_request()
                    for key, value in [('head_sha', SHA), ('head_branch', 'dev'), ('event', 'workflow_dispatch'),
                                       ('status', 'in_progress'), ('conclusion', 'failure')]:
                        api.return_value = {'workflow_runs': [{**run, key: value}]}
                        with self.subTest(key=key), self.assertRaises(ValueError): r.check_request()
                    api.return_value = {'workflow_runs': [run]}
                    with patch.object(r, 'command', side_effect=lambda args: 'changed-tree' if args == ['git','rev-parse',SHA+'^{tree}'] else command(args)):
                        with self.assertRaises(ValueError): r.check_request()
            finally: os.chdir(old)

    def test_archive_guards(self):
        for path in ['../outside', '/absolute', 'C:/file', 'a\\b', 'private/key', 'node_modules/x', 'a//b']:
            with self.subTest(path=path), self.assertRaises(ValueError): r.safe_path(path)

    def test_windows_archive_readback_rejects_changed_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'windows.zip'
            with zipfile.ZipFile(path, 'w') as z: z.writestr('AI Friends Kart.exe', b'example')
            records = {'AI Friends Kart.exe': dict(bytes=7, sha256=r.hashlib.sha256(b'example').hexdigest())}
            r.verify_zip_records(path, records)
            records['AI Friends Kart.exe']['sha256'] = '0' * 64
            with self.assertRaises(ValueError): r.verify_zip_records(path, records)

    def test_wrong_vendor_runtime_rejected_before_packaging(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'runtime.zip'; path.write_bytes(b'wrong vendor')
            with patch.dict(os.environ, ELECTRON_ZIP=str(path)), self.assertRaises(ValueError):
                r.package_windows(Path(temp), Path(temp) / 'output.zip')

    def test_relative_links(self):
        r.verify_html_links('<script src="./assets/app.js"></script>', {'assets/app.js'}, 'index.html')
        for href in ['/assets/app.js', '../app.js', 'https://example.com/app.js']:
            with self.subTest(href=href), self.assertRaises(ValueError):
                r.verify_html_links('<script src="' + href + '"></script>', {'assets/app.js'}, 'index.html')

    def test_workflow_requires_full_exact_commit_certification(self):
        workflow = (ROOT / '.github/workflows/release-stable.yml').read_text()
        for text in ['npm ci', 'npm run check', 'run: npm test', 'npm run build', 'npm run test:dist',
                     'ref: ${{ github.sha }}', 'fetch-depth: 0', 'validate-request', 'verify-draft', 'verify-published',
                     '--draft=false --prerelease=false --latest', 'needs: [certify, windows-smoke]']:
            self.assertIn(text, workflow)
        self.assertNotIn('--clobber', workflow)
        self.assertNotIn('git push', workflow)


if __name__ == '__main__': unittest.main()
