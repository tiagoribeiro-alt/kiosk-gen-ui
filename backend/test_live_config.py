import unittest

from app.core.live_config import build_live_connect_config, build_live_system_instruction


class LiveConfigTests(unittest.TestCase):
    def test_build_live_system_instruction_mentions_event_tool_guidance(self):
        instruction = build_live_system_instruction()

        self.assertIn('voice-first tourism assistant', instruction)
        self.assertIn('Centro de Portugal region', instruction)
        self.assertIn('prefer specific places such as Serra da Estrela', instruction)
        self.assertIn('Do not default to calling the region "Beiras"', instruction)
        self.assertNotIn('concierge', instruction)
        self.assertIn('get_events', instruction)
        self.assertIn('location, date, category, and limit', instruction)
        self.assertIn('get_weather', instruction)
        self.assertIn('Only call end_session after an explicit farewell', instruction)
        self.assertIn('Do not call end_session after thanks', instruction)
        self.assertIn('European Portuguese', instruction)

    def test_build_live_connect_config_includes_system_instruction_and_tools(self):
        config = build_live_connect_config()

        self.assertTrue(config.tools)
        self.assertEqual(config.response_modalities, ['AUDIO'])
        self.assertIsNotNone(config.input_audio_transcription)
        self.assertEqual(config.system_instruction, build_live_system_instruction())


if __name__ == '__main__':
    unittest.main()