import importlib.util,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
spec=importlib.util.spec_from_file_location('generator',Path(__file__).parents[1]/'scripts/prepare-reviewed-successor.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
class ExactSuccessorTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.b=self.root/'before';self.c=self.root/'after';self.b.mkdir();self.c.mkdir()
  for root,text in [(self.b,b'a\nold\nz\n'),(self.c,b'a\nnew\nz\n')]: (root/'a.ts').write_bytes(text)
  (self.c/'new.ts').write_bytes(b'new addition')
  def tree(root,ident):
   rows=[{'path':p.name,'type':'blob','mode':'100644','sha':g.git_blob(p.read_bytes())} for p in root.iterdir()]
   return {'sha':g.git_tree({r['path']:r for r in rows}),'truncated':False,'tree':rows}
  (self.root/'b.json').write_text(json.dumps(tree(self.b,'1')));(self.root/'c.json').write_text(json.dumps(tree(self.c,'2')))
  self.d={'baselineTree':json.loads((self.root/'b.json').read_text())['sha'],'candidateContentTree':json.loads((self.root/'c.json').read_text())['sha'],'paths':{p.name:{'decision':'approved','scope':'Synthetic fixture','evidence':['unit fixture'],'previousSha256':g.sha((self.b/p.name).read_bytes()) if (self.b/p.name).exists() else None,'currentSha256':g.sha(p.read_bytes())} for p in self.c.iterdir()}}
  self.args=SimpleNamespace(baseline=str(self.b),candidate=str(self.c),baseline_tree=str(self.root/'b.json'),candidate_tree=str(self.root/'c.json'),decisions=str(self.root/'d.json'))
 def tearDown(self):self.tmp.cleanup()
 def run_build(self):Path(self.args.decisions).write_text(json.dumps(self.d));return g.build(self.args)
 def test_exact_inverse_draft(self):
  r=self.run_build();self.assertEqual(r['state'],'DRAFT_REVIEW_REQUIRED');self.assertEqual(r['changes']['a.ts']['hunks'][0]['removedLines'],['old\n']);self.assertEqual(set(r['additions']),{'new.ts'})
 def test_missing_approval(self):
  del self.d['paths']['new.ts']
  with self.assertRaisesRegex(ValueError,'EXACT'):self.run_build()
 def test_one_byte_mutation(self):
  (self.c/'a.ts').write_bytes(b'a\nnew\nz\n ')
  with self.assertRaisesRegex(ValueError,'fixed Git blob'):self.run_build()
 def test_unknown_disk_addition(self):
  (self.c/'unknown.ts').write_bytes(b'unknown')
  with self.assertRaisesRegex(ValueError,'unlisted additions'):self.run_build()
 def test_wrong_snapshot(self):
  self.d['candidateContentTree']='3'*40
  with self.assertRaisesRegex(ValueError,'wrong snapshot'):self.run_build()
 def test_missing_behavioral_evidence(self):
  self.d['paths']['a.ts']['behavioralEvidenceRequired']=True
  with self.assertRaisesRegex(ValueError,'behavioral evidence'):self.run_build()
 def test_behavioral_evidence_retained(self):
  for path in ('a.ts','new.ts'):
   self.d['paths'][path].update(behavioralEvidenceRequired=True,behavioralEvidence=['Synthetic current runtime check passed'])
  result=self.run_build()
  for row in (result['changes']['a.ts'],result['additions']['new.ts']):
   self.assertIs(row['behavioralEvidenceRequired'],True);self.assertEqual(row['behavioralEvidence'],['Synthetic current runtime check passed'])
 def test_pending_review(self):
  self.d['paths']['a.ts']['decision']='pending'
  with self.assertRaisesRegex(ValueError,'Unapproved'):self.run_build()
if __name__=='__main__':unittest.main()
