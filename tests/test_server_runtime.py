import importlib.util,tempfile,unittest,zipfile,os
from unittest.mock import patch
from pathlib import Path
p=Path(__file__).parents[1]/'scripts/package-server-runtime.py';s=importlib.util.spec_from_file_location('runtime',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class RuntimeTests(unittest.TestCase):
 def fixture(self):
  root=Path(tempfile.mkdtemp());d=root/'dist';d.mkdir()
  for name in ['index.html','source.zip','LICENSE','NOTICE','source.html','assets/drivers/whale.glb.gz','models/food-karts/bundles/000.zip','balance-results/a.ts','.nojekyll','assets/app.js.map']:
   f=d/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_text('<a href="source.zip">Source</a><a href="LICENSE">License</a></body>')
  return d,root/'out'
 def test_preservation_paths_links(self):
  d,o=self.fixture();r=m.package(d,o,'a'*40);self.assertTrue(r['fullBuildUnchanged'])
  with zipfile.ZipFile(o/r['archive']) as z:
   self.assertIn('LICENSE.txt',z.namelist());self.assertNotIn('source.zip',z.namelist());self.assertIn('models/food-karts/bundles/000.zip',z.namelist());self.assertNotIn('balance-results/a.ts',z.namelist());self.assertIn(m.SOURCE,z.read('source.html').decode());self.assertIn('href="LICENSE.txt"',z.read('source.html').decode())
 def test_fail_closed(self):
  d,o=self.fixture()
  with self.assertRaises(ValueError):m.package(d,o,'main')
  (d/'bad.exe').write_text('bad')
  with self.assertRaises(ValueError):m.package(d,o,'a'*40)
 def test_opaque_is_narrow(self):
  self.assertTrue(m.allowed('assets/portraits/x.glb.gz'));self.assertFalse(m.allowed('evil.zip'));self.assertFalse(m.allowed('assets/drivers/deeper/x.glb.gz'))
class RuntimeVersionTests(unittest.TestCase):
 def test_both_pinned_versions_and_links(self):
  for mode,version in [('v1.1.0','1.1.0'),('v1.1.1-hotfix','1.1.1')]:
   spec=importlib.util.spec_from_file_location('runtime_version',p);module=importlib.util.module_from_spec(spec)
   with patch.dict(os.environ,STABLE_RELEASE_MODE=mode):spec.loader.exec_module(module)
   d,o=RuntimeTests().fixture();report=module.package(d,o,'a'*40)
   self.assertIn('v'+version,report['archive']);self.assertIn('/v'+version+'/',report['sourceUrl'])
   with zipfile.ZipFile(o/report['archive']) as z:self.assertIn('v'+version+' corresponding source',z.read('source.html').decode())
 def test_future_version_rejected(self):
  spec=importlib.util.spec_from_file_location('runtime_future',p);module=importlib.util.module_from_spec(spec)
  with patch.dict(os.environ,STABLE_RELEASE_MODE='v1.1.2-hotfix'),self.assertRaises(ValueError):spec.loader.exec_module(module)
if __name__=='__main__':unittest.main()
