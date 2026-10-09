import pathlib,unittest
from unittest.mock import patch
import summarize as s

def row():
    return {'markers':{'inputMs':10,'appliedMs':160,'firstCommittedRenderSubmitMs':174,
                      'outcome':'Applied','problems':[],'renderBinding':{'commandId':'c1'}},
            'raw':{'entries':[{'name':'hvp.cutBodyNativeAdmissionMs','duration':12,'detail':{'data':{'commandId':'c1'}}},
                              {'name':'hvp.cutBodyRenderStageMs','duration':7,'detail':{'data':{'commandId':'c1'}}}]}}
class PilotReader(unittest.TestCase):
    def test_actual_body_labels_and_foreign_command(self):
        value=row();self.assertEqual(s.phase_values(value,'cutBodyNativeAdmissionMs'),12)
        self.assertEqual(s.phase_values(value,'cutBodyRenderStageMs'),7)
        self.assertIsNone(s.phase_values(value,'cutBodyNativeAdmitMs'))
        value['markers']['renderBinding']['commandId']='foreign';self.assertIsNone(s.phase_values(value,'cutBodyRenderStageMs'))
    def test_missing_is_not_zero(self):
        value=row();del value['markers']['appliedMs'];self.assertEqual(s.cut_sample(value)['status'],'MISSING')
        self.assertIsNone(s.stats([]));self.assertEqual(s.stats([0])['median'],0)
    def test_nearest_rank_preserves_slow_valid_sample(self):
        result=s.stats(list(range(1,10))+[741]);self.assertEqual(result['n'],10)
        self.assertEqual(result['p95NearestRank'],741);self.assertEqual(result['atMostTarget'],9)
    def test_wrong_variant_rejected(self):
        with patch.object(pathlib.Path,'exists',return_value=True),patch.object(s,'read',return_value={'name':'wrong-variant'}):
            with self.assertRaisesRegex(ValueError,'variant'):s.cohort(pathlib.Path('.'),['control','candidate'],1)
    def test_incomplete_population_and_invalid_stay_visible(self):
        def read(path):return {'name':path.stem,'failed':None if 'control' in path.name else 'PointerLock',
                               'errors':[],'results':[row(),row()]}
        with patch.object(pathlib.Path,'exists',return_value=True),patch.object(s,'read',side_effect=read):
            result=s.cohort(pathlib.Path('.'),['control','candidate'],1)
        self.assertEqual(result['variants']['candidate']['moving']['invalid'],1)
        self.assertIsNone(result['variants']['candidate']['moving']['inputToRenderMs'])
        self.assertEqual(result['pairedCandidateControlRatio']['moving'],[None])
    def test_existing_evidence_never_overwritten(self):
        with self.assertRaises(FileExistsError):s.write_result(pathlib.Path(__file__),{'bad':'overwrite'})
    def test_actual_d1_sample_retains_drops_and_command_binding(self):
        old=row();value={'sample':old['markers'],'commandId':'c1','problems':[],'raw':old['raw']}
        self.assertEqual(s.cut_sample(value)['status'],'VALID');self.assertEqual(s.phase_values(value,'cutBodyNativeAdmissionMs'),12)
        value['raw']['dropped']=1;self.assertEqual(s.cut_sample(value)['status'],'INVALID')
    def test_combined_prefix_and_navigation_samples_stay_separate(self):
        def read(path):
            if path.name=='NATIVE_EXIT.json':return {'exitCode':0}
            if path.name=='pw-report.json':return {'stats':{'expected':1,'unexpected':0}}
            self.assertEqual(path.parent.name,'d3-d4-pair-0')
            return {'mode':path.stem,'failure':None,'errors':[],'results':[row(),row(),row()],
                    'controlledFaultPageErrors':['HVP_CONTROLLED_DRAW_AFTER_APPLIED'],
                    'ready':{'entries':[{'name':'hvp.coldSceneReadyV2Ms','duration':4000}]},
                    'loadReady':{'entries':[{'name':'hvp.loadSceneReadyV2Ms','duration':2000}]},
                    'coldLoadReady':{'entries':[{'name':'hvp.coldSceneReadyV2Ms','duration':5100}]}}
        with patch.object(pathlib.Path,'exists',return_value=True),patch.object(s,'read',side_effect=read):
            result=s.cohort(pathlib.Path('.'),['control','candidate'],1,d1=True,pair_prefix='d3-d4')
        self.assertEqual(result['variants']['candidate']['coldTerrain']['valid'],1)
        nav=result['navigationReadiness']['candidate'];self.assertEqual(nav['ready']['values'],[4000])
        self.assertEqual(nav['loadReady']['values'],[2000]);self.assertEqual(nav['coldLoadReady']['values'],[5100])
        self.assertEqual(nav['coldLoadReady']['atMostTarget'],0)
    def test_combined_failed_native_exit_invalidates_cut_population(self):
        def read(path):
            if path.name=='NATIVE_EXIT.json':return {'exitCode':1}
            if path.name=='pw-report.json':return {'stats':{'expected':0,'unexpected':1}}
            return {'mode':path.stem,'failure':None,'errors':[],'results':[row(),row(),row()]}
        with patch.object(pathlib.Path,'exists',return_value=True),patch.object(s,'read',side_effect=read):
            result=s.cohort(pathlib.Path('.'),['control','candidate'],1,d1=True,pair_prefix='d3-d4')
        self.assertFalse(result['nativeComplete']);self.assertEqual(result['variants']['candidate']['coldTerrain']['invalid'],1)
if __name__=='__main__':unittest.main()
