"""Pinned hotfix source, scoped evidence and publication guard regressions."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
def load(mode):
    spec = importlib.util.spec_from_file_location('hotfix', ROOT / 'scripts/stable-release.py')
    module = importlib.util.module_from_spec(spec)
    with patch.dict(os.environ, STABLE_RELEASE_MODE=mode):
        spec.loader.exec_module(module)
    return module
r = load('v1.1.1-hotfix')
SHA, TREE, PREP = 'a'*40, 'b'*40, 'c'*40

class HotfixTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, GITHUB_SHA=SHA, GITHUB_REF='refs/heads/main',
            GITHUB_WORKFLOW_REF=r.REPOSITORY+'/'+r.WORKFLOW_PATH+'@refs/heads/main',
            GITHUB_WORKFLOW_SHA=SHA, GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='2', HOTFIX_STEP_OUTCOME='success')
        self.env.start(); self.addCleanup(self.env.stop)
        self.context = dict(sha=SHA, tree=TREE, ref='refs/heads/main')

    def args(self):
        return dict(sha=SHA, parents=[r.PARENT,PREP], repository=r.REPOSITORY,
            ref='refs/heads/main', event_name='push', event=dict(before=r.PARENT,after=SHA))

    def test_request_pins_scope_flags_and_five_assets(self):
        self.assertEqual(json.loads((ROOT/r.REQUEST_PATH).read_text()),r.REQUEST)
        r.validate_request(r.REQUEST,**self.args())
        self.assertFalse(r.PRERELEASE); self.assertTrue(r.LATEST)
        self.assertEqual(len(r.RELEASE_ASSETS),5)
        self.assertIn('v1.1.1',r.WINDOWS_NAME)
        for key in r.REQUEST:
            with self.subTest(key=key),self.assertRaises(ValueError):
                r.validate_request({**r.REQUEST,key:None},**self.args())

    def test_wrong_source_context_and_future_mode_fail_closed(self):
        for key,value in [('parents',[PREP,r.PARENT]),('parents',[r.PARENT]),('ref','refs/heads/'+r.CERT_BRANCH),
                          ('event_name','workflow_dispatch'),('event',dict(before=PREP,after=SHA))]:
            with self.subTest(key=key),self.assertRaises(ValueError):
                r.validate_request(r.REQUEST,**{**self.args(),key:value})
        with self.assertRaises(ValueError):load('v1.1.2-hotfix')

    def test_runtime_delta_rejected_and_release_allowlist_narrow(self):
        for path in ['src/scene.ts','src/menu-backdrop.ts','src/waterpark-reflection.ts','public/evil.js','README.secrets.md']:
            with patch.object(r,'command',return_value=path),self.subTest(path=path),self.assertRaises(ValueError):r.validate_hotfix_delta(SHA)
        def git_bytes(args):
            return b'{"version": "1.1.0"} 1.1.0' if args[2].startswith(r.DEV_PARENT) else b'{"version": "1.1.1"} 1.1.0' if args[2].endswith('.json') else b'{"version": "1.1.1"} 1.1.1'
        with patch.object(r,'command',return_value='package.json\ndocs/pages-snapshot.json\nREADME.md'),patch.object(r.subprocess,'check_output',side_effect=git_bytes):
            r.validate_hotfix_delta(SHA)
        with patch.object(r,'command',return_value='package.json'),patch.object(r.subprocess,'check_output',return_value=b'changed dependencies'),self.assertRaises(ValueError):
            r.validate_hotfix_delta(SHA)

    def test_evidence_is_scoped_exact_source_without_reuse(self):
        evidence=r.regression_evidence(self.context,require_step_outcome=True)
        self.assertFalse(evidence['fullSuitePassedInThisRun']);self.assertIsNone(evidence['fullSuite'])
        self.assertEqual(evidence['mode'],'scoped-hotfix-final-main')
        self.assertEqual(evidence['sourceCommit'],SHA);self.assertEqual(evidence['acceptedDevCommit'],r.DEV_PARENT)
        self.assertEqual(evidence['scopedTests']['command'],r.HOTFIX_COMMAND)
        for outcome in ['skipped','failure','cancelled','']:
            with patch.dict(os.environ,HOTFIX_STEP_OUTCOME=outcome),self.assertRaises(ValueError):
                r.regression_evidence(self.context,require_step_outcome=True)
        with patch.dict(os.environ,GITHUB_WORKFLOW_SHA=PREP),self.assertRaises(ValueError):r.regression_evidence(self.context)
        with self.assertRaises(ValueError):r.regression_evidence({**self.context,'ref':'refs/heads/dev'})

    def test_manifest_tampering_rejected(self):
        evidence=r.regression_evidence(self.context)
        with patch.object(r,'check_request',return_value=self.context):
            r.verify_regression_evidence(dict(regressionCertification=evidence))
            for key,value in [('sourceCommit',PREP),('fullSuitePassedInThisRun',True),('fullSuite',{}),('mode','reused-identical-candidate')]:
                with self.subTest(key=key),self.assertRaises(ValueError):
                    r.verify_regression_evidence(dict(regressionCertification={**evidence,key:value}))

    def test_publication_requires_current_scoped_and_windows_job_success(self):
        run=dict(id=123,run_attempt=2,head_sha=SHA,head_branch='main',event='push',path=r.WORKFLOW_PATH,
                 name=r.WORKFLOW_NAME,workflow_id=7,repository=dict(full_name=r.REPOSITORY),head_repository=dict(full_name=r.REPOSITORY))
        jobs=[dict(name=name,run_id=123,run_attempt=2,head_sha=SHA,head_branch='main',workflow_name=r.WORKFLOW_NAME,
                   status='completed',conclusion='success',steps=[dict(name=step,status='completed',conclusion='success')])
              for name,step in [('certify',r.HOTFIX_STEP),('windows-smoke',r.WINDOWS_SMOKE_STEP)]]
        responses={'actions/runs/123/attempts/2':run,'actions/runs/123/attempts/2/jobs?per_page=100':dict(total_count=2,jobs=jobs)}
        with patch.object(r,'workflow_identity',return_value=7),patch.object(r,'api',side_effect=lambda path:responses[path]):
            r.verify_hotfix_jobs()
            for job in jobs:
                for key,value in [('head_sha',PREP),('run_attempt',1),('conclusion','failure'),('status','in_progress')]:
                    previous=job[key];job[key]=value
                    with self.subTest(job=job['name'],key=key),self.assertRaises(ValueError):r.verify_hotfix_jobs()
                    job[key]=previous
                job['steps'][0]['conclusion']='skipped'
                with self.assertRaises(ValueError):r.verify_hotfix_jobs()
                job['steps'][0]['conclusion']='success'
            run['head_repository']={'full_name':'other/repo'}
            with self.assertRaises(ValueError):r.verify_hotfix_jobs()

    def test_public_source_gate_requires_stable_latest_exact_main_and_source(self):
        source_hash = 'd'*64
        manifest = dict(schemaVersion=1,version=r.VERSION,tag=r.TAG,repository=r.REPOSITORY,
            sourceCommit=SHA,expectedParentSha=r.PARENT,expectedDevParentSha=r.DEV_PARENT,
            channel='release',target='html+windows-x64',prerelease=False,latest=True,
            files={'source.zip':dict(bytes=123,sha256=source_hash)})
        data=json.dumps(manifest).encode()
        assets=[dict(id=n,name=name,state='uploaded',size=123,digest='sha256:'+source_hash,
                     browser_download_url=f'https://github.com/{r.REPOSITORY}/releases/download/{r.TAG}/{name}')
                for n,name in enumerate(r.RELEASE_ASSETS,1)]
        for asset in assets:
            if asset['name']==r.MANIFEST_NAME:
                asset['size']=len(data);asset['digest']='sha256:'+r.hashlib.sha256(data).hexdigest()
        release=dict(id=9,draft=False,prerelease=False,assets=assets,
            html_url=f'https://github.com/{r.REPOSITORY}/releases/tag/{r.TAG}')
        responses={'releases/latest':dict(id=9),'git/ref/tags/'+r.TAG:dict(object=dict(type='commit',sha=SHA))}
        with patch.object(r,'current_head'),patch.object(r,'find_release',return_value=release), \
             patch.object(r,'api',side_effect=lambda path:responses[path]),patch.object(r.subprocess,'check_output',return_value=data):
            self.assertEqual(r.public_source_release(expected_sha=source_hash,expected_bytes=123)['sourceCommit'],SHA)
            release['prerelease']=True
            with self.assertRaises(ValueError):r.public_source_release()
            release['prerelease']=False;responses['releases/latest']['id']=8
            with self.assertRaises(ValueError):r.public_source_release()
            responses['releases/latest']['id']=9;responses['git/ref/tags/'+r.TAG]['object']['sha']=PREP
            with self.assertRaises(ValueError):r.public_source_release()
            responses['git/ref/tags/'+r.TAG]['object']['sha']=SHA
            with self.assertRaises(ValueError):r.public_source_release(expected_sha='e'*64,expected_bytes=123)

    def test_workflow_matches_scoped_command_and_publication_order(self):
        workflow=(ROOT/r.WORKFLOW_PATH).read_text()
        for text in [r.HOTFIX_COMMAND, r.HOTFIX_STEP, 'STABLE_RELEASE_MODE: v1.1.1-hotfix', 'branches: [main]',
                     'ref: ${{ github.sha }}', 'fetch-depth: 0', 'npm ci', 'npm run check', 'npm run build',
                     'npm run test:dist', 'needs: [certify, windows-smoke]', '--prerelease=false --latest',
                     '--draft --latest=false', 'HOTFIX_STEP_OUTCOME: ${{ steps.hotfix_suite.outcome }}',
                     'python3 scripts/stable-release.py verify-certification\n          gh release edit',
                     'v1.1.1-windows-x64.zip']:
            self.assertIn(text,workflow)
        for text in ['run: npm test','continue-on-error','--clobber','workflow_dispatch','--prerelease=true']:
            self.assertNotIn(text,workflow)
        self.assertLess(workflow.index('npm run test:dist'),workflow.index('scripts/stable-release.py package'))

if __name__=='__main__':unittest.main()
