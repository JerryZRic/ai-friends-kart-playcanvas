import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from contextlib import contextmanager
from types import SimpleNamespace
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('stable_release', ROOT / 'scripts/stable-release.py')
r = importlib.util.module_from_spec(spec)
with patch.dict(os.environ, STABLE_RELEASE_MODE='v1.1.0'):
    spec.loader.exec_module(r)
SHA = 'a' * 40
RC = 'b' * 40
TREE = 'c' * 40
WORKFLOW_ID = 731
RUN_ID = 412
ATTEMPT = 2


class RequestTests(unittest.TestCase):
    def args(self, main=True):
        return dict(sha=SHA, parents=[r.PARENT, RC] if main else [r.DEV_PARENT],
                    repository=r.REPOSITORY, ref='refs/heads/main' if main else 'refs/heads/' + r.CERT_BRANCH,
                    event_name='push', event=dict(before=r.PARENT, after=SHA))

    def test_exact_request(self):
        self.assertEqual(r.REQUEST['version'], '1.1.0')
        r.validate_request(r.REQUEST, **self.args())
        r.validate_request(r.REQUEST, **self.args(False))

    def test_mutated_request_rejected(self):
        for key in r.REQUEST:
            with self.subTest(key=key), self.assertRaises(ValueError):
                r.validate_request({**r.REQUEST, key: None}, **self.args())

    def test_wrong_context_rejected(self):
        for key, value in [('sha', 'main'), ('parents', [r.PARENT]), ('parents', [r.PARENT, RC, SHA]), ('parents', [RC, r.PARENT]),
                           ('repository', 'other/repo'), ('ref', 'refs/heads/dev'), ('event_name', 'workflow_dispatch'),
                           ('event', dict(before=RC, after=SHA)), ('event', dict(before=r.PARENT, after=RC))]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                r.validate_request(r.REQUEST, **{**self.args(), key: value})

    def test_all_release_assets_and_stable(self):
        self.assertEqual(len(r.RELEASE_ASSETS), 5)
        self.assertIn(r.WINDOWS_NAME, r.RELEASE_ASSETS)
        self.assertFalse(r.REQUEST['prerelease'])
        self.assertTrue(r.REQUEST['latest'])

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

    def test_historical_default_still_requires_full_candidate_evidence(self):
        self.assertFalse(r.HOTFIX)
        self.assertEqual(r.FULL_SUITE_STEP, 'Run complete stable regression suite')
        self.assertEqual(r.VERSION, '1.1.0')
        self.assertFalse(r.PRERELEASE)
        self.assertTrue(r.LATEST)


def good_run():
    return dict(id=RUN_ID, run_attempt=ATTEMPT, workflow_id=WORKFLOW_ID, path=r.WORKFLOW_PATH,
                name=r.WORKFLOW_NAME, repository=dict(full_name=r.REPOSITORY),
                head_repository=dict(full_name=r.REPOSITORY), head_sha=RC, head_branch=r.CERT_BRANCH,
                event='push', status='completed', conclusion='success',
                html_url=f'https://github.com/{r.REPOSITORY}/actions/runs/{RUN_ID}')


def good_jobs():
    jobs = [dict(name=name, run_id=RUN_ID, run_attempt=ATTEMPT, head_sha=RC, head_branch=r.CERT_BRANCH,
                 workflow_name=r.WORKFLOW_NAME, status='completed', conclusion='success',
                 steps=[dict(name=step, status='completed', conclusion='success')])
            for name, step in [('certify', r.FULL_SUITE_STEP), ('windows-smoke', r.WINDOWS_SMOKE_STEP)]]
    return dict(total_count=len(jobs), jobs=jobs)


class CertificationTests(unittest.TestCase):
    def setUp(self):
        self.run = good_run()
        self.jobs = good_jobs()
        self.workflow = dict(id=WORKFLOW_ID, path=r.WORKFLOW_PATH, name=r.WORKFLOW_NAME, state='active')
        self.responses = {
            'actions/workflows/release-stable.yml': self.workflow,
            f'actions/workflows/release-stable.yml/runs?head_sha={RC}&per_page=100': {'workflow_runs': [self.run]},
            f'actions/runs/{RUN_ID}/attempts/{ATTEMPT}': self.run,
            f'actions/runs/{RUN_ID}/attempts/{ATTEMPT}/jobs?per_page=100': self.jobs,
        }
        self.api_patch = patch.object(r, 'api', side_effect=lambda path: self.responses[path])
        self.api = self.api_patch.start()
        self.addCleanup(self.api_patch.stop)

    @contextmanager
    def checkout(self, candidate=False):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'docs').mkdir()
            (root / r.REQUEST_PATH).write_text(json.dumps(r.REQUEST))
            (root / 'package.json').write_text(json.dumps(dict(version=r.VERSION)))
            sha = RC if candidate else SHA
            ref = 'refs/heads/' + r.CERT_BRANCH if candidate else 'refs/heads/main'
            event = root / 'event.json'
            event.write_text(json.dumps(dict(before=r.PARENT, after=sha)))
            def command(args):
                if args == ['git', 'rev-parse', 'HEAD']: return sha
                if args[:3] == ['git', 'show', '-s']: return r.DEV_PARENT if candidate else r.PARENT + ' ' + RC
                if args[:3] == ['git', 'diff', '--name-only']: return r.REQUEST_PATH
                if args in [['git', 'rev-parse', SHA + '^{tree}'], ['git', 'rev-parse', RC + '^{tree}']]: return TREE
                raise AssertionError(args)
            old = Path.cwd()
            os.chdir(root)
            try:
                with patch.dict(os.environ, GITHUB_SHA=sha, GITHUB_EVENT_PATH=str(event),
                        GITHUB_REPOSITORY=r.REPOSITORY, GITHUB_REF=ref, GITHUB_EVENT_NAME='push',
                        GITHUB_WORKFLOW_REF=r.REPOSITORY + '/' + r.WORKFLOW_PATH + '@' + ref,
                        GITHUB_WORKFLOW_SHA=sha, GITHUB_RUN_ID=str(RUN_ID if candidate else RUN_ID + 1),
                        GITHUB_RUN_ATTEMPT=str(ATTEMPT if candidate else 1),
                        FULL_SUITE_STEP_OUTCOME='success' if candidate else 'skipped'), \
                     patch.object(r, 'command', side_effect=command) as mocked_command, \
                     patch.object(r.subprocess, 'run', return_value=SimpleNamespace(returncode=0)):
                    yield root, mocked_command
            finally:
                os.chdir(old)

    def test_completed_full_candidate_workflow_accepted(self):
        with self.checkout():
            context = r.check_request()
            self.assertEqual(context['candidate']['candidateCommit'], RC)
            self.assertEqual(context['candidate']['candidateTree'], TREE)
            self.assertEqual(context['candidate']['runId'], RUN_ID)
            self.assertEqual(context['candidate']['runAttempt'], ATTEMPT)
            self.assertEqual(context['candidate']['workflowConclusion'], 'success')

    def test_candidate_identity_and_status_mutations_rejected(self):
        mutations = [('repository', {'full_name': 'attacker/repo'}),
                     ('head_repository', {'full_name': 'attacker/fork'}), ('head_repository', None),
                     ('head_sha', SHA), ('head_branch', 'dev'), ('event', 'workflow_dispatch'),
                     ('workflow_id', WORKFLOW_ID + 1), ('path', '.github/workflows/release-html.yml'),
                     ('name', 'Other workflow'), ('status', 'in_progress'), ('status', 'queued'),
                     ('conclusion', 'failure'), ('conclusion', 'cancelled'), ('conclusion', None),
                     ('run_attempt', 0), ('run_attempt', True), ('id', 0), ('id', True),
                     ('html_url', 'https://example.invalid/run')]
        for key, value in mutations:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                r.validate_candidate_run({**self.run, key: value}, candidate=RC, workflow_id=WORKFLOW_ID)

    def test_wrong_workflow_metadata_rejected(self):
        for key, value in [('id', 0), ('path', '.github/workflows/other.yml'), ('name', 'Other'), ('state', 'disabled_manually')]:
            with self.subTest(key=key), patch.object(r, 'api', return_value={**self.workflow, key: value}), self.assertRaises(ValueError):
                r.workflow_identity()

    def test_failed_or_running_candidate_is_never_reused(self):
        with self.checkout():
            for key, value in [('status', 'in_progress'), ('status', 'queued'), ('conclusion', 'failure'),
                               ('head_branch', 'main'), ('workflow_id', WORKFLOW_ID + 1)]:
                original = self.run[key]
                self.run[key] = value
                with self.subTest(key=key), self.assertRaises(ValueError): r.check_request()
                self.run[key] = original

    def test_listing_cannot_substitute_for_verified_run_attempt(self):
        self.responses[f'actions/runs/{RUN_ID}/attempts/{ATTEMPT}'] = {**self.run, 'conclusion': 'failure'}
        with self.checkout(), self.assertRaises(ValueError): r.check_request()

    def test_wrong_attempt_rejected(self):
        self.responses[f'actions/runs/{RUN_ID}/attempts/{ATTEMPT}'] = {**self.run, 'run_attempt': ATTEMPT + 1}
        with self.checkout(), self.assertRaises(ValueError): r.check_request()

    def test_required_candidate_jobs_and_steps_rejected_if_not_passed(self):
        for job_index in (0, 1):
            for area in ('job', 'step'):
                for key, value in [('status', 'in_progress'), ('conclusion', 'failure'), ('conclusion', 'skipped'), ('conclusion', None)]:
                    jobs = good_jobs()
                    target = jobs['jobs'][job_index]
                    if area == 'step': target = target['steps'][0]
                    target[key] = value
                    with self.subTest(job=job_index, area=area, key=key, value=value), self.assertRaises(ValueError):
                        r.validate_candidate_jobs(jobs, candidate=RC, run_id=RUN_ID, attempt=ATTEMPT)

    def test_job_evidence_bound_to_exact_run_attempt_source(self):
        for key, value in [('run_id', RUN_ID + 1), ('run_attempt', ATTEMPT + 1), ('head_sha', SHA),
                           ('head_branch', 'main'), ('workflow_name', 'Other')]:
            jobs = good_jobs()
            jobs['jobs'][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                r.validate_candidate_jobs(jobs, candidate=RC, run_id=RUN_ID, attempt=ATTEMPT)

    def test_missing_duplicate_or_partial_job_evidence_rejected(self):
        malformed = [dict(total_count=3, jobs=good_jobs()['jobs']), dict(total_count=1, jobs=good_jobs()['jobs'][:1]),
                     dict(total_count=3, jobs=good_jobs()['jobs'] + [good_jobs()['jobs'][0]])]
        for jobs in malformed:
            with self.subTest(jobs=jobs), self.assertRaises(ValueError):
                r.validate_candidate_jobs(jobs, candidate=RC, run_id=RUN_ID, attempt=ATTEMPT)
        for replacement in ([], [dict(name='Different test', status='completed', conclusion='success')]):
            jobs = good_jobs()
            jobs['jobs'][0]['steps'] = replacement
            with self.assertRaises(ValueError):
                r.validate_candidate_jobs(jobs, candidate=RC, run_id=RUN_ID, attempt=ATTEMPT)

    def test_optional_publish_job_must_be_skipped_on_candidate(self):
        jobs = good_jobs()
        publish = {**jobs['jobs'][0], 'name': 'publish', 'conclusion': 'skipped', 'steps': []}
        jobs['jobs'].append(publish)
        jobs['total_count'] += 1
        r.validate_candidate_jobs(jobs, candidate=RC, run_id=RUN_ID, attempt=ATTEMPT)
        publish['conclusion'] = 'success'
        with self.assertRaises(ValueError):
            r.validate_candidate_jobs(jobs, candidate=RC, run_id=RUN_ID, attempt=ATTEMPT)

    def test_whole_tree_mismatch_rejected_before_run_lookup(self):
        with self.checkout() as (_, command):
            original = command.side_effect
            command.side_effect = lambda args: 'd' * 40 if args == ['git', 'rev-parse', SHA + '^{tree}'] else original(args)
            with self.assertRaisesRegex(ValueError, 'certified candidate tree'): r.check_request()
        self.api.assert_not_called()

    def test_candidate_checks_do_not_look_for_reusable_run(self):
        with self.checkout(candidate=True):
            context = r.check_request()
            self.assertNotIn('candidate', context)
        self.api.assert_not_called()

    def test_candidate_packaging_requires_successful_actual_suite_step(self):
        with self.checkout(candidate=True):
            context = r.check_request()
            for outcome in ('skipped', 'failure', 'cancelled', ''):
                with self.subTest(outcome=outcome), patch.dict(os.environ, FULL_SUITE_STEP_OUTCOME=outcome), self.assertRaises(ValueError):
                    r.regression_evidence(context, require_step_outcome=True)
            proof = r.regression_evidence(context, require_step_outcome=True)
            self.assertTrue(proof['fullSuitePassedInThisRun'])
            self.assertEqual(proof['mode'], 'full-suite-this-run')
            self.assertEqual(proof['fullSuite']['candidateCommit'], RC)
            self.assertEqual(proof['fullSuite']['stepConclusion'], 'success')
            self.assertEqual(proof['fullSuite']['workflowStatus'], 'in_progress')
            self.assertIsNone(proof['fullSuite']['workflowConclusion'])
            self.assertIsNone(proof['finalMainCommit'])

    def test_main_evidence_names_original_run_candidate_tree_and_final_sha(self):
        with self.checkout():
            proof = r.regression_evidence(r.check_request(), require_step_outcome=True)
            self.assertFalse(proof['fullSuitePassedInThisRun'])
            self.assertEqual(proof['mode'], 'reused-identical-candidate')
            self.assertEqual(proof['sourceCommit'], SHA)
            self.assertEqual(proof['sourceTree'], TREE)
            self.assertEqual(proof['finalMainCommit'], SHA)
            self.assertEqual(proof['fullSuite']['candidateCommit'], RC)
            self.assertEqual(proof['fullSuite']['candidateTree'], TREE)
            self.assertEqual(proof['fullSuite']['runId'], RUN_ID)
            self.assertEqual(proof['fullSuite']['runAttempt'], ATTEMPT)
            self.assertEqual(proof['fullSuite']['workflowStatus'], 'completed')
            self.assertEqual(proof['fullSuite']['workflowConclusion'], 'success')
            r.verify_regression_evidence(dict(regressionCertification=proof), require_main=True)

    def test_current_run_identity_or_workflow_mismatch_rejected(self):
        with self.checkout(candidate=True):
            context = r.check_request()
            for key, value in [('GITHUB_WORKFLOW_SHA', SHA), ('GITHUB_WORKFLOW_REF', 'wrong'),
                               ('GITHUB_RUN_ID', ''), ('GITHUB_RUN_ID', '0'), ('GITHUB_RUN_ATTEMPT', '0')]:
                with self.subTest(key=key), patch.dict(os.environ, {key: value}), self.assertRaises(ValueError):
                    r.regression_evidence(context, require_step_outcome=True)

    def test_proof_mutations_rejected(self):
        with self.checkout():
            proof = r.regression_evidence(r.check_request())
            for key in proof:
                changed = {**proof, key: None}
                with self.subTest(key=key), self.assertRaises(ValueError):
                    r.verify_regression_evidence(dict(regressionCertification=changed), require_main=True)
            for key in proof['fullSuite']:
                changed = copy.deepcopy(proof)
                changed['fullSuite'][key] = None
                with self.subTest(fullSuite=key), self.assertRaises(ValueError):
                    r.verify_regression_evidence(dict(regressionCertification=changed), require_main=True)
            with self.assertRaises(ValueError): r.verify_regression_evidence({})

    def test_original_successful_attempt_is_pinned_during_reverification(self):
        with self.checkout():
            proof = r.regression_evidence(r.check_request())
            self.api.reset_mock()
            # A later rerun does not replace the original successful proof.
            self.responses[f'actions/workflows/release-stable.yml/runs?head_sha={RC}&per_page=100'] = {'workflow_runs': []}
            r.verify_regression_evidence(dict(regressionCertification=proof), require_main=True)
            self.assertFalse(any('runs?head_sha=' in call.args[0] for call in self.api.call_args_list))
            self.assertTrue(any(f'actions/runs/{RUN_ID}/attempts/{ATTEMPT}' == call.args[0] for call in self.api.call_args_list))

    def test_final_publish_rechecks_original_complete_workflow(self):
        with self.checkout() as (root, _):
            proof = r.regression_evidence(r.check_request())
            output = root / 'release-stable'
            output.mkdir()
            (output / r.MANIFEST_NAME).write_text(json.dumps(dict(sourceCommit=SHA, regressionCertification=proof)))
            r.verify_publication_certification(output)
            self.run['status'] = 'in_progress'
            with self.assertRaises(ValueError): r.verify_publication_certification(output)

    def test_candidate_cannot_publish(self):
        with self.checkout(candidate=True):
            proof = r.regression_evidence(r.check_request())
            with self.assertRaises(ValueError):
                r.verify_regression_evidence(dict(regressionCertification=proof), require_main=True)

    def test_packaging_cannot_start_before_full_suite_pass(self):
        with self.checkout(candidate=True), patch.dict(os.environ, FULL_SUITE_STEP_OUTCOME='failure'), \
             patch.object(r, 'verify_dist') as verify_dist, self.assertRaises(ValueError):
            r.make_package()
        verify_dist.assert_not_called()

    def test_real_git_tree_equality_has_no_workflow_file_exception(self):
        # Exercise actual Git tree and parent plumbing, without copying game assets.
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
            git('init', '-q')
            git('config', 'user.name', 'Release guard test')
            git('config', 'user.email', 'test@example.invalid')
            (root / 'docs').mkdir()
            (root / r.REQUEST_PATH).write_text('{}')
            (root / 'package.json').write_text(json.dumps(dict(version=r.VERSION)))
            git('add', '.')
            git('commit', '-qm', 'Approved parent')
            parent = git('rev-parse', 'HEAD')
            (root / r.REQUEST_PATH).write_text(json.dumps(r.REQUEST))
            workflow_path = root / r.WORKFLOW_PATH
            workflow_path.parent.mkdir(parents=True)
            workflow_path.write_text('candidate workflow bytes\n')
            (root / 'game.txt').write_text('candidate game bytes\n')
            git('add', '.')
            git('commit', '-qm', 'Candidate')
            candidate = git('rev-parse', 'HEAD')
            tree = git('rev-parse', 'HEAD^{tree}')
            good = {**good_run(), 'head_sha': candidate}
            jobs = good_jobs()
            for job in jobs['jobs']: job['head_sha'] = candidate
            responses = {**self.responses,
                f'actions/workflows/release-stable.yml/runs?head_sha={candidate}&per_page=100': {'workflow_runs': [good]},
                f'actions/runs/{RUN_ID}/attempts/{ATTEMPT}': good,
                f'actions/runs/{RUN_ID}/attempts/{ATTEMPT}/jobs?per_page=100': jobs}
            event_path = root.parent / (root.name + '-push-event.json')
            old = Path.cwd()
            os.chdir(root)
            try:
                with patch.object(r, 'PARENT', parent), patch.object(r, 'DEV_PARENT', parent), \
                     patch.object(r, 'api', side_effect=lambda path: responses[path]):
                    for changed_path in (None, 'game.txt', r.WORKFLOW_PATH):
                        git('reset', '--hard', candidate)
                        if changed_path:
                            (root / changed_path).write_text('changed final bytes\n')
                            git('add', changed_path)
                        final_tree = git('write-tree')
                        final_sha = git('commit-tree', final_tree, '-p', parent, '-p', candidate, '-m', 'Final main')
                        git('checkout', '-q', '--detach', final_sha)
                        event_path.write_text(json.dumps(dict(before=parent, after=final_sha)))
                        with patch.dict(os.environ, GITHUB_SHA=final_sha, GITHUB_EVENT_PATH=str(event_path),
                                GITHUB_REPOSITORY=r.REPOSITORY, GITHUB_REF='refs/heads/main', GITHUB_EVENT_NAME='push'):
                            if changed_path is None:
                                self.assertEqual(r.check_request()['tree'], tree)
                            else:
                                with self.subTest(path=changed_path), self.assertRaisesRegex(ValueError, 'certified candidate tree'):
                                    r.check_request()
            finally:
                os.chdir(old)
                event_path.unlink(missing_ok=True)

    def test_manifest_verification_rechecks_certification(self):
        # Verify this fail-closed hook cannot silently disappear from archive readback.
        import inspect
        self.assertIn('verify_regression_evidence(manifest)', inspect.getsource(r.verify_package))
        self.assertIn('verify_publication_certification()', inspect.getsource(r.verify_remote))


if __name__ == '__main__': unittest.main()
