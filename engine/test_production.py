import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from generate_static_deck import build_deck, build_content_deck
from content_contract import validate_content
from pptx import Presentation
from validate_production import validate_production


class ProductionValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / 'deck.pptx'

    def content(self, language='en'):
        return {'version': 1, 'title': 'Customer presentation', 'language': language,
                'slides': [{'title': 'বাংলা পরিকল্পনা' if language != 'en' else 'A real plan',
                            'bullets': ['Customer evidence', '<script>plain text only</script>'],
                            'notes': 'Actual speaker notes'},
                           {'title': 'Next steps', 'bullets': ['Review and approve'], 'notes': ''}]}

    def test_real_customer_content_and_notes_round_trip_in_all_languages(self):
        for language in ('en', 'bn', 'bilingual'):
            content = self.content(language)
            result = build_content_deck(content, self.output)
            self.assertEqual(result['content_source'], 'VALIDATED_CUSTOMER_DRAFT')
            report = validate_production(self.output, 2, language, content)
            self.assertTrue(report['passed'], report)
            self.assertEqual('UNVERIFIED', report['visual_approval'])
            self.assertEqual('Actual speaker notes', Presentation(self.output).slides[0].notes_slide.notes_text_frame.text)

    def test_customer_content_mismatches_block_package(self):
        for field in ('title', 'bullets', 'notes'):
            content = self.content()
            build_content_deck(content, self.output)
            content['slides'][0][field] = ['Changed'] if field == 'bullets' else 'Changed'
            self.assertFalse(validate_production(self.output, 2, 'en', content)['passed'])

    def test_placeholder_package_cannot_validate_as_customer_content(self):
        build_deck('Customer presentation', 2, 'en', self.output)
        self.assertFalse(validate_production(self.output, 2, 'en', self.content())['passed'])

    def test_tampered_footer_fails_content_validation(self):
        content = self.content()
        build_content_deck(content, self.output)
        presentation = Presentation(self.output)
        footer = next(shape for shape in presentation.slides[0].shapes if shape.name == 'Role_SlideNumber')
        footer.text = 'Unexpected customer-facing text'
        presentation.save(self.output)
        self.assertFalse(validate_production(self.output, 2, 'en', content)['passed'])

    def test_contract_rejects_invalid_text_and_drops_control_fields(self):
        content = self.content()
        content['price'] = 0
        self.assertNotIn('price', validate_content(content))
        for title in ('\x00invalid', '😀' * 61):
            content['slides'][0]['title'] = title
            with self.assertRaises(ValueError):
                build_content_deck(content, self.output)
        content = self.content()
        content['version'] = True
        with self.assertRaises(ValueError):
            validate_content(content)

    def test_real_static_english_and_bengali_decks(self):
        for language in ('en', 'bn', 'bilingual'):
            build_deck('Production validator test', 3, language, self.output)
            report = validate_production(self.output, 3, language)
            self.assertTrue(report['passed'], report)
            self.assertEqual('UNVERIFIED', report['desktop_playback'])

    def test_slide_count_mismatch_blocks_output(self):
        build_deck('Test', 3, 'en', self.output)
        self.assertFalse(validate_production(self.output, 4, 'en')['passed'])

    def test_corrupt_package_blocks_output(self):
        self.output.write_bytes(b'not a zip')
        self.assertFalse(validate_production(self.output, 3, 'en')['passed'])

    def test_unexpected_motion_blocks_static_output(self):
        build_deck('Test', 3, 'en', self.output)
        with ZipFile(self.output) as package:
            parts = {name: package.read(name) for name in package.namelist()}
        parts['ppt/slides/slide1.xml'] = parts['ppt/slides/slide1.xml'].replace(
            b'</p:sld>', b'<p:transition><p:fade/></p:transition></p:sld>')
        with ZipFile(self.output, 'w', ZIP_DEFLATED) as package:
            for name, content in parts.items():
                package.writestr(name, content)
        self.assertFalse(validate_production(self.output, 3, 'en')['passed'])

    def test_missing_relationship_blocks_output(self):
        build_deck('Test', 3, 'en', self.output)
        with ZipFile(self.output) as package:
            parts = {name: package.read(name) for name in package.namelist()}
        del parts['ppt/slides/slide1.xml']
        with ZipFile(self.output, 'w', ZIP_DEFLATED) as package:
            for name, content in parts.items():
                package.writestr(name, content)
        self.assertFalse(validate_production(self.output, 3, 'en')['passed'])


if __name__ == '__main__':
    unittest.main()
