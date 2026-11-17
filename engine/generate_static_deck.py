#!/usr/bin/env python3
"""
Real (not fixture) Static-tier .pptx generator for a single customer project.

Honesty boundary: this produces an actual, valid, zero-motion PowerPoint
package from python-pptx - it is NOT a fixture and NOT the Phase 0
experimental spike (engine/phase0.py, which only builds its fixed 8-slide
test corpus and is not parameterized per-project).

The --content path renders validated customer draft titles, bullets and notes.
The metadata-only CLI path is a labeled legacy placeholder sandbox. The
renderer does not generate AI content, approve designs or verify payment.
Those boundaries are enforced by the application workflow.

Static tier has zero transitions and zero entrance animations by definition
(see docs/requirements-analysis.md section 5.1), so no Open XML patching is
needed here at all - plain python-pptx output already satisfies that.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from content_contract import validate_content

BG = RGBColor(0x09, 0x0A, 0x0C)
TITLE_BORDER = RGBColor(0x3B, 0x82, 0xF6)
TEXT = RGBColor(0xF3, 0xF4, 0xF6)

PLACEHOLDER_NOTICE = {
    "bilingual": "[কন্টেন্ট তৈরি মুলতুবি — Content generation pending] এই স্লাইডের বিষয়বস্তু এখনো তৈরি হয়নি।",
    "bn": "[কন্টেন্ট তৈরি মুলতুবি] এই স্লাইডের বিষয়বস্তু এখনো তৈরি হয়নি।",
    "en": "[Content generation pending] This slide's real content has not been generated yet.",
}


def build_content_deck(content: dict, output_path: Path) -> dict:
    """Render validated customer text. This is not evidence of visual approval."""
    content = validate_content(content)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    for index, item in enumerate(content['slides']):
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = BG
        title = slide.shapes.add_textbox(Inches(.75), Inches(.55), Inches(11.8), Inches(1.25))
        title.name = 'Role_Title'
        title.text_frame.word_wrap = True
        title.text_frame.text = item['title']
        for run in title.text_frame.paragraphs[0].runs:
            run.font.size, run.font.bold, run.font.color.rgb = Pt(28), True, TEXT
            run.font.name = 'Nirmala UI'
        body = slide.shapes.add_textbox(Inches(.75), Inches(2), Inches(11.8), Inches(4.65))
        body.name = 'Role_Body'
        body.text_frame.word_wrap = True
        # Keep a deterministic layout; visual overflow still requires renderer QA.
        font_size = 18 if sum(map(len, item['bullets'])) <= 700 else 14
        for i, bullet in enumerate(item['bullets']):
            paragraph = body.text_frame.paragraphs[0] if i == 0 else body.text_frame.add_paragraph()
            paragraph.text = bullet
            paragraph.space_after = Pt(12)
            for run in paragraph.runs:
                run.font.name = 'Nirmala UI'
                run.font.size, run.font.color.rgb = Pt(font_size), TEXT
        slide.notes_slide.notes_text_frame.text = item['notes']
        footer = slide.shapes.add_textbox(Inches(.75), Inches(7), Inches(11.8), Inches(.25))
        footer.name = 'Role_SlideNumber'
        footer.text_frame.text = f'{index + 1} / {len(content["slides"])}'
        for run in footer.text_frame.paragraphs[0].runs:
            run.font.size, run.font.color.rgb = Pt(10), TEXT
    prs.core_properties.title = content['title']
    prs.core_properties.language = content['language']
    output_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_path))
    data = output_path.read_bytes()
    return {'output_path': str(output_path), 'byte_size': len(data),
            'sha256': hashlib.sha256(data).hexdigest(), 'slide_count': len(content['slides']),
            'tier': 'static', 'content_source': 'VALIDATED_CUSTOMER_DRAFT',
            'visual_approval': 'UNVERIFIED'}


def build_deck(title: str, slide_count: int, language_mode: str, output_path: Path) -> dict:
    if slide_count < 1 or slide_count > 100:
        raise ValueError("slide_count must be between 1 and 100")
    notice = PLACEHOLDER_NOTICE.get(language_mode, PLACEHOLDER_NOTICE["en"])

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    for i in range(1, slide_count + 1):
        slide = prs.slides.add_slide(blank_layout)
        bg = slide.background
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG

        title_box = slide.shapes.add_textbox(Inches(0.75), Inches(0.5), Inches(11.8), Inches(1.2))
        title_box.name = "Role_Title"
        tf = title_box.text_frame
        tf.text = f"{title} — Slide {i} of {slide_count}" if i > 1 else title
        run = tf.paragraphs[0].runs[0]
        run.font.size = Pt(28)
        run.font.bold = True
        run.font.color.rgb = TEXT

        body_box = slide.shapes.add_textbox(Inches(0.75), Inches(2.0), Inches(11.8), Inches(4.5))
        body_box.name = "Role_Body_Placeholder"
        body_tf = body_box.text_frame
        body_tf.word_wrap = True
        body_tf.text = notice
        body_run = body_tf.paragraphs[0].runs[0]
        body_run.font.size = Pt(18)
        body_run.font.color.rgb = TEXT

    output_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_path))

    data = output_path.read_bytes()
    return {
        "output_path": str(output_path),
        "byte_size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "slide_count": slide_count,
        "tier": "static",
        "content_source": "PLACEHOLDER_NOT_AI_GENERATED",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title")
    parser.add_argument("--slide-count", type=int)
    parser.add_argument("--content", type=Path, help='Validated draft JSON. Does not confer design approval.')
    parser.add_argument("--language-mode", default="bilingual", choices=["bilingual", "bn", "en"])
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    try:
        if args.content:
            if args.title is not None or args.slide_count is not None:
                raise ValueError('CONTENT_AND_PLACEHOLDER_ARGUMENTS_CONFLICT')
            if args.content.stat().st_size > 1048576:
                raise ValueError('CONTENT_TOO_LARGE')
            result = build_content_deck(json.loads(args.content.read_text(encoding='utf-8')), args.output)
        else:
            if not args.title or args.slide_count is None:
                raise ValueError('CONTENT_OR_SANDBOX_METADATA_REQUIRED')
            result = build_deck(args.title, args.slide_count, args.language_mode, args.output)
        print(json.dumps(result))
    except Exception as exc:  # noqa: BLE001 - surface any failure as structured JSON on stderr
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
