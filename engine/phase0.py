#!/usr/bin/env python3
"""Experimental PowerPoint package spike. No model-authored per-deck XML accepted.
This is a structural/policy checker, NOT an XSD validator or PowerPoint player.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import io
import json
import posixpath
import re
import time
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
import pptx

ROOT = Path(__file__).resolve().parent
REGISTRY = json.loads((ROOT / 'registry.json').read_text())
TEMPLATES = ROOT / 'templates' / REGISTRY['template_version']
NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
PARSER = E.XMLParser(resolve_entities=False, no_network=True)

def parse(data):
    if b'<!DOCTYPE' in data or b'<!ENTITY' in data:
        raise ValueError('DTD/entities forbidden')
    return E.fromstring(data, parser=PARSER)

def children(node, query):
    return node.xpath(query, namespaces=NS)

def template(name):
    return parse((TEMPLATES / name).read_bytes())

def canonical_group(node):
    node=copy.deepcopy(node)
    for item in node.iter():
        if item.text is not None and not item.text.strip(): item.text=None
        if item.tail is not None and not item.tail.strip(): item.tail=None
        if E.QName(item).localname=='cTn':
            item.set('id','0')
            if item.get('dur') in ('400','500','600'): item.set('dur','500')
        if E.QName(item).localname=='spTgt': item.set('spid','0')
    return E.tostring(node,method='c14n')

def q(name):
    return '{' + NS['p'] + '}' + name

def write_package(parts, path):
    with ZipFile(path, 'w', ZIP_DEFLATED) as z:
        for name, data in sorted(parts.items()):
            # Fixed ZIP timestamps make generated output reproducible.
            from zipfile import ZipInfo
            info = ZipInfo(name, (2026, 10, 26, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            z.writestr(info, data)

SLIDES = [
    ('Bilingual motion specimen', 'বাংলা ও ইংরেজি উপস্থাপনা', [('title', 'Bilingual motion specimen\nবাংলা ও ইংরেজি উপস্থাপনা'), ('closing', 'Phase 0 experimental package / পরীক্ষামূলক ফাইল')], 0),
    ('English text and image role', 'ইংরেজি পাঠ্য', [('title', 'English text and image role'), ('bullets', 'Design approval\nMotion selection\nItemized quote'), ('image', 'IMAGE ROLE FIXTURE\nNative text shape used as a target')], 3),
    ('বাংলা অক্ষর ও যুক্তাক্ষর', 'Bengali typography', [('title', 'বাংলা অক্ষর ও যুক্তাক্ষর'), ('image', 'ক্ষ ত্র শ্র জ্ঞ\nবাংলাদেশের উদ্যোগ ও প্রযুক্তি'), ('bullets', 'Font substitution and shaping require desktop review')], 1),
    ('Chart role remains still', 'চার্ট অ্যানিমেশন নেই', [('title', 'Chart role remains still'), ('chart', 'STATIC DATA FIXTURE\n10 slides: Static BDT 250 / Smooth BDT 360'), ('image', 'IMAGE ROLE FIXTURE\nNo chart animation in Smooth')], 0),
    ('Dense content policy', 'আটটি বুলেট', [('title', 'Dense content policy / আটটি বুলেট'), ('bullets', '\n'.join(f'{i}. তথ্যের নমুনা / Content item' for i in range(1, 9))), ('image', 'Suppressed above six bullets'), ('quote', 'Only title animates in provisional dense policy')], 8),
    ('Five-entrance cap', 'সর্বোচ্চ পাঁচটি', [('title', 'Five-entrance cap / সর্বোচ্চ পাঁচটি')] + [('image', f'Role fixture {i}') for i in range(1,5)] + [('quote', 'Overflow role six'), ('quote', 'Overflow role seven')], 0),
    ('Quote role specimen', 'উদ্ধৃতির নমুনা', [('title', 'Quote role specimen'), ('quote', '“পরীক্ষার প্রমাণ ছাড়া অনুমোদন নয়”\nDesktop playback approval remains pending')], 0),
    ('Desktop QA next', 'পরবর্তী ধাপ', [('title', 'Desktop QA next / পরবর্তী ধাপ'), ('closing', 'Windows + Mac + older Office\nEvery effect remains disabled for production')], 0),
]

def static_parts():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    from datetime import datetime, timezone
    prs.core_properties.created = datetime(2026, 10, 26, tzinfo=timezone.utc)
    prs.core_properties.modified = datetime(2026, 10, 26, tzinfo=timezone.utc)
    prs.core_properties.title = 'AI Presentation Platform Phase 0 experimental specimen'
    prs.core_properties.author = 'Phase 0 engineering spike'
    for n, (title, subtitle, roles, bullet_count) in enumerate(SLIDES, 1):
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = RGBColor.from_string('090A0C')
        count = len(roles)
        for i, (role, content) in enumerate(roles):
            if i == 0:
                x,y,w,h,size = .7,.6,11.9,1.3,32
            elif count > 5:
                x,y,w,h,size = .8 + ((i-1)%3)*4.1,2.3 + ((i-1)//3)*1.5,3.7,1.2,22
            elif bullet_count > 6 and role == 'bullets':
                x,y,w,h,size = .8,2,7,4.5,20
            else:
                x,y,w,h,size = .8,2 + (i-1)*1.4,11.7,1.3,24
            if bullet_count > 6 and role in ('image','quote'):
                x,y,w,h,size = 8.2,2 + (i-2)*1.8,4,1.5,18
            shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
            shape.name = f'role:{role}:{i}:bullets={bullet_count}'
            tf = shape.text_frame
            tf.word_wrap = True
            for line_i, line in enumerate(content.split('\n')):
                p = tf.paragraphs[0] if line_i == 0 else tf.add_paragraph()
                p.text = line
                p.font.name = 'Noto Sans Bengali'
                p.font.size = Pt(size)
                p.font.color.rgb = RGBColor.from_string('F3F4F6' if i == 0 else 'BFC8D8')
        shape = slide.shapes.add_textbox(Inches(.8), Inches(7.05), Inches(11.7), Inches(.25))
        shape.name = 'fixture-footer'
        shape.text = f'{n:02d} / 08   EXPERIMENTAL • Desktop playback and Bengali shaping unverified'
        for p in shape.text_frame.paragraphs:
            p.font.name = 'Arial'; p.font.size = Pt(11); p.font.color.rgb = RGBColor.from_string('94A3B8')
    buf = io.BytesIO(); prs.save(buf)
    with ZipFile(buf) as z:
        return {n:z.read(n) for n in z.namelist()}

def select_targets(root):
    roles = []
    bullet_count = 0
    for prop in children(root, './/p:cNvPr'):
        match = re.match(r'role:([^:]+):\d+:bullets=(\d+)', prop.get('name', ''))
        if match:
            role, count = match.groups(); bullet_count = max(bullet_count,int(count))
            roles.append((prop.get('id'), role))
    chosen = [(spid, role) for spid, role in roles if role in REGISTRY['smooth_roles']]
    if bullet_count > 6:
        chosen = [(spid, role) for spid, role in chosen if role == 'title']
    return chosen[:REGISTRY['max_entrances_per_slide']]

def patch(root, transition, entrance_mode, slide_n, intensity='standard'):
    if transition not in REGISTRY['transitions']:
        raise ValueError(f'Unknown transition: {transition}')
    if entrance_mode not in ('smooth','experimental-coverage'):
        raise ValueError('Unknown entrance mode')
    durations = {'subtle':400,'standard':500,'dynamic':600}
    duration = durations[intensity]
    transition_node = copy.deepcopy(template('transitions.xml').find(f"effect[@id='{transition}']")[0])
    timing = template('timing.xml')
    sequence = children(timing, './/p:cTn[@nodeType="mainSeq"]/p:childTnLst')[0]
    selections = []
    for index, (spid,role) in enumerate(select_targets(root)):
        effect_id = 'fade' if entrance_mode == 'smooth' else list(REGISTRY['entrances'])[(slide_n-1)%4]
        effect = template('entrances.xml').find(f"effect[@id='{effect_id}']")
        group = template('entrance-group.xml')
        effect_ctn = children(group, './/p:cTn[@presetClass="entr"]')[0]
        effect_ctn.set('presetID',effect.get('preset_id'))
        effect_list = children(effect_ctn, './p:childTnLst')[0]
        behavior = copy.deepcopy(effect[0])
        children(behavior, './p:cBhvr/p:cTn')[0].set('dur', str(duration))
        effect_list.append(behavior)
        for target in children(group, './/p:spTgt'):
            target.set('spid',spid)
        sequence.append(group)
        selections.append({'shape_id':spid,'role':role,'entrance_id':effect_id,'duration_ms':duration,'trigger':'withEffect','delay_ms':0})
    for i, node in enumerate(children(timing, './/p:cTn'),1):
        node.set('id',str(i))
    # PresentationML order: cSld, clrMapOvr?, transition?, timing?, extLst?
    ext = root.find(q('extLst'))
    if ext is None:
        root.append(transition_node); root.append(timing)
    else:
        idx = list(root).index(ext); root.insert(idx,transition_node); root.insert(idx+1,timing)
    return selections

def validate(path, tier, transition=None, entrance_mode='smooth', expected_slide_count=8, require_bengali=True):
    errors = []; slide_evidence = []
    try:
        with ZipFile(path) as z:
            if z.testzip(): errors.append('ZIP CRC failure')
            if len(z.namelist()) != len(set(z.namelist())): errors.append('Duplicate ZIP part')
            parts = {n:z.read(n) for n in z.namelist()}
    except Exception as e:
        return {'passed':False,'errors':[f'Invalid ZIP: {type(e).__name__}'],'slides':[]}
    roots = {}
    for name,data in parts.items():
        if name.endswith(('.xml','.rels')):
            try: roots[name] = parse(data)
            except Exception as e: errors.append(f'{name}: malformed XML or forbidden DTD')
    for required in ['[Content_Types].xml','_rels/.rels','ppt/presentation.xml','ppt/_rels/presentation.xml.rels']:
        if required not in roots: errors.append(f'Missing required part {required}')
    content_types = roots.get('[Content_Types].xml')
    if content_types is not None:
        defaults = {n.get('Extension') for n in content_types if E.QName(n).localname=='Default'}
        overrides = {n.get('PartName').lstrip('/') for n in content_types if E.QName(n).localname=='Override'}
        for name in parts:
            if name == '[Content_Types].xml': continue
            if name not in overrides and name.rsplit('.',1)[-1] not in defaults: errors.append(f'No content type: {name}')
        for name in overrides:
            if name not in parts: errors.append(f'Content type points to missing part {name}')
    relationships = {}
    for name,root in roots.items():
        if not name.endswith('.rels'): continue
        source = '' if name=='_rels/.rels' else posixpath.join(posixpath.dirname(posixpath.dirname(name)),posixpath.basename(name)[:-5])
        ids = set(); relationships[source] = {}
        for rel in root:
            rid = rel.get('Id')
            if rid in ids: errors.append(f'{name}: duplicate relationship id')
            ids.add(rid)
            if rel.get('TargetMode')=='External':
                errors.append(f'{name}: unexpected external relationship'); continue
            target = rel.get('Target','')
            target = posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join(posixpath.dirname(source),target))
            if target.startswith('../') or target not in parts: errors.append(f'{name}: unresolved relationship {target}')
            relationships[source][rid] = target
    for name,root in roots.items():
        for node in root.iter():
            for key,val in node.attrib.items():
                if key in [f'{{{NS["r"]}}}id',f'{{{NS["r"]}}}embed',f'{{{NS["r"]}}}link'] and val not in relationships.get(name,{}):
                    errors.append(f'{name}: unresolved r:id {val}')
    slide_names = sorted([n for n in roots if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)],key=lambda n:int(re.search(r'(\d+)\.xml',n).group(1)))
    if len(slide_names)!=expected_slide_count: errors.append(f'Expected exactly {expected_slide_count} slides')
    pres = roots.get('ppt/presentation.xml')
    if pres is not None:
        order = [relationships.get('ppt/presentation.xml',{}).get(x.get(f'{{{NS["r"]}}}id')) for x in children(pres,'./p:sldIdLst/p:sldId')]
        if order!=slide_names: errors.append('Presentation slide order differs from specimen order')
    for index,name in enumerate(slide_names,1):
        root = roots[name]; local_errors = []
        names = [E.QName(x).localname for x in root]
        permitted_order = {'cSld':0,'clrMapOvr':1,'transition':2,'timing':3,'extLst':4}
        if any(x not in permitted_order for x in names) or [permitted_order.get(x,99) for x in names]!=sorted(permitted_order.get(x,99) for x in names): local_errors.append('Slide child ordering mismatch')
        props = children(root,'.//p:cNvPr'); shape_ids = [x.get('id') for x in props]
        if len(shape_ids)!=len(set(shape_ids)): local_errors.append('Duplicate shape ID')
        transitions = children(root,'./p:transition'); timing = children(root,'./p:timing')
        entrances = children(root,'.//p:cTn[@presetClass="entr"]')
        choices = []
        if tier=='static':
            if transitions or timing: local_errors.append('Static slide contains motion')
        elif tier=='smooth':
            if len(transitions)!=1 or len(timing)!=1: local_errors.append('Smooth requires one transition and timing tree')
            if transitions:
                effects = [E.QName(x).localname for x in transitions[0]]
                if effects!=[transition]: local_errors.append('Transition differs from requested identifier')
            if len(entrances)>5: local_errors.append('Entrance cap exceeded')
            expected_targets = select_targets(root)
            actual_targets=[]
            for ctn in entrances:
                targets = children(ctn,'.//p:spTgt')
                targets_set={x.get('spid') for x in targets}
                if len(targets_set)!=1: local_errors.append('Entrance has inconsistent targets')
                target=next(iter(targets_set),'')
                actual_targets.append(target)
                if target not in shape_ids: local_errors.append('Dangling shape target')
                if ctn.get('nodeType')!='withEffect': local_errors.append('Unexpected entrance trigger')
                if [x.get('delay') for x in children(ctn,'./p:stCondLst/p:cond')]!=['0']: local_errors.append('Unexpected entrance delay')
                preset=ctn.get('presetID'); filters=children(ctn,'.//p:animEffect')
                effect_map={'10':'fade','22':'wipe','23':'zoom','2':'slide_in'}
                effect_id=effect_map.get(preset)
                if effect_id not in REGISTRY['entrances']: local_errors.append('Unregistered entrance preset')
                if effect_id=='fade' and [x.get('filter') for x in filters]!=['fade']: local_errors.append('Fade template filter mismatch')
                if effect_id=='wipe' and [x.get('filter') for x in filters]!=['wipe(right)']: local_errors.append('Wipe template filter mismatch')
                if effect_id=='zoom' and not children(ctn,'.//p:animScale'): local_errors.append('Zoom template missing scale')
                if effect_id=='slide_in' and not children(ctn,'.//p:animMotion[@path="M 0 1 L 0 0 E"]'): local_errors.append('Slide-in template missing path')
                if effect_id in REGISTRY['entrances']:
                    effect_template=template('entrances.xml').find(f"effect[@id='{effect_id}']")
                    expected_group=template('entrance-group.xml')
                    expected_ctn=children(expected_group,'.//p:cTn[@presetClass="entr"]')[0]
                    expected_ctn.set('presetID',effect_template.get('preset_id'))
                    children(expected_ctn,'./p:childTnLst')[0].append(copy.deepcopy(effect_template[0]))
                    actual_group=ctn.getparent().getparent().getparent().getparent()
                    if canonical_group(actual_group)!=canonical_group(expected_group): local_errors.append('Entrance XML differs from controlled template')
                expected_id = 'fade' if entrance_mode=='smooth' else list(REGISTRY['entrances'])[(index-1)%4]
                if effect_id!=expected_id: local_errors.append('Entrance differs from requested identifier')
                choices.append({'shape_id':target,'entrance_id':effect_id})
            if actual_targets != [x[0] for x in expected_targets]: local_errors.append('Role/cap/dense policy target mismatch')
            ids=[x.get('id') for x in children(root,'.//p:cTn')]
            if len(ids)!=len(set(ids)) or any(not x or not x.isdigit() for x in ids): local_errors.append('Duplicate/invalid timing IDs')
            if not children(root,'.//p:cTn[@nodeType="tmRoot"]') or not children(root,'.//p:cTn[@nodeType="mainSeq"]'): local_errors.append('Missing root/main sequence')
        else: local_errors.append('Unknown tier')
        errors.extend(f'{name}: {e}' for e in local_errors)
        slide_evidence.append({'slide':index,'entrance_count':len(entrances),'choices':choices,'structural_policy_pass':not local_errors})
    text=''.join(''.join(children(roots[n],'.//a:t/text()')) for n in slide_names)
    if require_bengali and not re.search('[\u0980-\u09ff]',text): errors.append('Bengali text missing')
    return {'passed':not errors,'validation_scope':'ZIP/XML/OPC and explicit policy subset; NOT full XSD or playback','errors':errors,'slides':slide_evidence}

def run_all(output):
    output.mkdir(parents=True,exist_ok=True)
    specs=[('static',None,'smooth')] + [('smooth',t,'smooth') for t in REGISTRY['transitions']] + [('smooth','fade','experimental-coverage')]
    results=[]
    for tier,transition,mode in specs:
        started=time.perf_counter(); parts=static_parts(); choices=[]
        if tier=='smooth':
            for n in range(1,9):
                name=f'ppt/slides/slide{n}.xml'; root=parse(parts[name])
                choices.append({'slide':n,'animations':patch(root,transition,mode,n)})
                parts[name]=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
        filename='phase0_static.pptx' if tier=='static' else f'phase0_{tier}_{transition}_{mode}.pptx'
        path=output/filename; write_package(parts,path)
        gen_ms=round((time.perf_counter()-started)*1000,3)
        started=time.perf_counter(); evidence=validate(path,tier,transition,mode); val_ms=round((time.perf_counter()-started)*1000,3)
        # High-level parser reopens package. It does not render or assess animation.
        reopened_count=len(Presentation(path).slides)
        result={'filename':filename,'tier':tier,'transition_id':transition,'entrance_mode':mode,'generator':f'python-pptx {pptx.__version__} + controlled template patcher 1.0','policy_version':REGISTRY['policy_version'],'template_version':REGISTRY['template_version'],'template_sha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(TEMPLATES.glob('*.xml'))},'generation_ms':gen_ms,'validation_ms':val_ms,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'reopen_slide_count':reopened_count,'production_approved':False,'desktop_playback':'UNVERIFIED','recordings':[],'animation_choices':choices,'validation':evidence}
        (output/(path.stem+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
        results.append(result)
    manifest={'results':results,'all_structural_policy_checks_passed':all(r['validation']['passed'] for r in results),'desktop_gate_passed':False,'production_motion_enabled':False,'cost_note':'CPU wall times measured locally once per specimen. Provider cost, licensed Office QA labor and operational cost not measured.'}
    (output/'phase0-results.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    return manifest

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--output-dir',type=Path,default=ROOT.parent/'artifacts'); args=parser.parse_args()
    result=run_all(args.output_dir)
    print(json.dumps({'specimens':len(result['results']),'structural_policy_pass':result['all_structural_policy_checks_passed'],'desktop_gate':False,'production_motion_enabled':False},indent=2))
    raise SystemExit(0 if result['all_structural_policy_checks_passed'] else 1)

if __name__=='__main__': main()
