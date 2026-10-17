import importlib.util,tempfile,unittest,zipfile
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
if __name__=='__main__':unittest.main()
