import copy
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import phase0 as p

class Phase0Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(); cls.out=Path(cls.tmp.name)
        cls.result=p.run_all(cls.out)
        cls.smooth=cls.out/'phase0_smooth_fade_smooth.pptx'
        with ZipFile(cls.smooth) as z: cls.parts={n:z.read(n) for n in z.namelist()}
    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()
    def mutate(self,callback,slide=1):
        parts=dict(self.parts); name=f'ppt/slides/slide{slide}.xml'; root=p.parse(parts[name]); callback(root)
        parts[name]=E.tostring(root); dest=self.out/'negative.pptx'; p.write_package(parts,dest)
        return p.validate(dest,'smooth','fade')
    def test_all_specimens_pass_structural_policy(self):
        self.assertTrue(self.result['all_structural_policy_checks_passed'])
        self.assertEqual(6,len(self.result['results']))
        self.assertTrue(all(x['reopen_slide_count']==8 for x in self.result['results']))
    def test_all_production_effects_disabled(self):
        self.assertFalse(p.REGISTRY['production_enabled'])
        for family in ['transitions','entrances']:
            self.assertTrue(all(not x['production_enabled'] for x in p.REGISTRY[family].values()))
    def test_cap_and_dense_policy(self):
        slides=self.result['results'][1]['validation']['slides']
        self.assertEqual(1,slides[4]['entrance_count'])
        self.assertEqual(5,slides[5]['entrance_count'])
    def test_static_has_zero_motion(self):
        self.assertTrue(all(s['entrance_count']==0 for s in self.result['results'][0]['validation']['slides']))
    def test_experimental_coverage_has_all_four_entrances(self):
        ids={x['entrance_id'] for s in self.result['results'][-1]['validation']['slides'] for x in s['choices']}
        self.assertEqual(set(p.REGISTRY['entrances']),ids)
    def test_reproducible_bytes(self):
        dest=self.out/'repeat'; result=p.run_all(dest)
        self.assertEqual([r['sha256'] for r in self.result['results']],[r['sha256'] for r in result['results']])
    def test_dangling_target_rejected(self):
        r=self.mutate(lambda root:p.children(root,'.//p:spTgt')[0].set('spid','99999'))
        self.assertFalse(r['passed'])
    def test_duplicate_timing_id_rejected(self):
        r=self.mutate(lambda root:p.children(root,'.//p:cTn')[1].set('id','1'))
        self.assertFalse(r['passed'])
    def test_unknown_entrance_rejected(self):
        r=self.mutate(lambda root:p.children(root,'.//p:cTn[@presetClass="entr"]')[0].set('presetID','999'))
        self.assertFalse(r['passed'])
    def test_wrong_transition_rejected(self):
        r=self.mutate(lambda root:setattr(p.children(root,'./p:transition')[0][0],'tag',p.q('push')))
        self.assertFalse(r['passed'])
    def test_incorrect_filter_rejected(self):
        r=self.mutate(lambda root:p.children(root,'.//p:animEffect')[0].set('filter','arbitrary-model-xml'))
        self.assertFalse(r['passed'])
    def test_static_motion_rejected(self):
        self.assertFalse(p.validate(self.smooth,'static')['passed'])
    def test_timing_order_rejected(self):
        def reorder(root):
            node=p.children(root,'./p:timing')[0]; root.remove(node); root.insert(0,node)
        self.assertFalse(self.mutate(reorder)['passed'])
    def test_wrong_trigger_rejected(self):
        r=self.mutate(lambda root:p.children(root,'.//p:cTn[@presetClass="entr"]')[0].set('nodeType','clickEffect'))
        self.assertFalse(r['passed'])
    def test_animation_cap_rejected(self):
        def exceed(root):
            target=p.children(root,'.//p:cTn[@nodeType="mainSeq"]/p:childTnLst')[0]
            target.append(copy.deepcopy(target[0]))
        self.assertFalse(self.mutate(exceed,6)['passed'])
    def test_unresolved_opc_reference_rejected(self):
        parts=dict(self.parts); del parts['ppt/slides/slide8.xml']; dest=self.out/'missing.pptx';p.write_package(parts,dest)
        self.assertFalse(p.validate(dest,'smooth','fade')['passed'])
    def test_broken_xml_rejected(self):
        parts=dict(self.parts);parts['ppt/slides/slide1.xml']=b'<broken';dest=self.out/'broken.pptx';p.write_package(parts,dest)
        self.assertFalse(p.validate(dest,'smooth','fade')['passed'])
    def test_dtd_rejected(self):
        with self.assertRaises(ValueError):p.parse(b'<!DOCTYPE a [<!ENTITY e "x">]><a>&e;</a>')
    def test_unknown_identifier_no_substitution(self):
        root=p.parse(self.parts['ppt/slides/slide1.xml'])
        with self.assertRaises(ValueError):p.patch(root,'made-up','smooth',1)
    def test_unapproved_duration_rejected(self):
        r=self.mutate(lambda root:p.children(root,'.//p:animEffect/p:cBhvr/p:cTn')[0].set('dur','98765'))
        self.assertFalse(r['passed'])
    def test_extra_behavior_rejected(self):
        def inject(root):
            target=p.children(root,'.//p:cTn[@presetClass="entr"]/p:childTnLst')[0]
            target.append(E.Element(p.q('anim')))
        self.assertFalse(self.mutate(inject)['passed'])
    def test_intensity_exact_duration_scales(self):
        for intensity,duration in [('subtle',400),('standard',500),('dynamic',600)]:
            root=p.parse(p.static_parts()['ppt/slides/slide1.xml'])
            choices=p.patch(root,'fade','smooth',1,intensity)
            self.assertTrue(all(c['duration_ms']==duration for c in choices))
    def test_corrupt_archive_rejected(self):
        dest=self.out/'corrupt.pptx';dest.write_bytes(b'not a zip')
        self.assertFalse(p.validate(dest,'smooth','fade')['passed'])

if __name__=='__main__': unittest.main(verbosity=2)
