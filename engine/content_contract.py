"""Untrusted JSON contract shared in meaning with shared/presentation.ts.

Only plain text enters python-pptx. AI-authored XML, prices and tool commands
are never consumed. JS lengths count UTF-16 code units, so mirror that here.
"""
import re


def _text(value, limit, empty=False):
    if (not isinstance(value, str) or (not empty and not value.strip())
            or len(value.encode('utf-16-le')) // 2 > limit
            or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value)):
        raise ValueError('CONTENT_VALIDATION_FAILED')
    return value.strip()


def validate_content(value, expected_count=None):
    if (not isinstance(value, dict) or type(value.get('version')) is not int or value['version'] != 1
            or value.get('language') not in ('en', 'bn', 'bilingual')
            or not isinstance(value.get('slides'), list) or not 1 <= len(value['slides']) <= 100
            or (expected_count is not None and len(value['slides']) != expected_count)):
        raise ValueError('CONTENT_VALIDATION_FAILED')
    slides = []
    for slide in value['slides']:
        if (not isinstance(slide, dict) or not isinstance(slide.get('bullets'), list)
                or not 1 <= len(slide['bullets']) <= 6):
            raise ValueError('CONTENT_VALIDATION_FAILED')
        slides.append({'title': _text(slide.get('title'), 120),
                       'bullets': [_text(bullet, 280) for bullet in slide['bullets']],
                       'notes': _text(slide.get('notes', ''), 2000, True)})
    return {'version': 1, 'title': _text(value.get('title'), 200),
            'language': value['language'], 'slides': slides}
