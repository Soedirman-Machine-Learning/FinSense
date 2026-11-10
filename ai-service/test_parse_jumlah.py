"""
Tests for parse_jumlah with the decided product name.

Sizes and brand numbers inside a catalog name ("beras rojolele lima kilogram",
"dua kelinci kacang") must never be read as the item quantity, while a
quantity spoken around the name still must be.

Run:
    ./venv/bin/python -m unittest test_parse_jumlah -v
"""

import json
import os
import unittest

from inference_wrapper_v10 import parse_jumlah

_LOOKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       'model_v10', 'unit_price_lookup.json')
with open(_LOOKUP, encoding='utf-8') as f:
    PRODUK_VOCAB = json.load(f)['produk_vocab']

BERAS = 'beras rojolele lima kilogram'
MAKNYUSS = 'beras maknyuss lima kilogram'
SPRITE = 'sprite satu liter'
BIMOLI = 'bimoli minyak goreng dua liter'
GULA = 'gula pasir tiga kilogram'
KELINCI = 'dua kelinci kacang'
KAKI_TIGA = 'kaki tiga larutan lima ratus mililiter'
SAMPOERNA = 'sampoerna mild enam belas'


class ProdukOnly(unittest.TestCase):
    """No quantity spoken: the parser must find none (caller defaults to 1)."""

    def test_every_catalog_name_alone(self):
        for produk in PRODUK_VOCAB:
            with self.subTest(produk=produk):
                self.assertIsNone(parse_jumlah(produk, produk))
                self.assertIsNone(parse_jumlah(f'jual {produk}', produk))

    def test_reported_cases(self):
        self.assertIsNone(parse_jumlah(BERAS, BERAS))
        self.assertIsNone(parse_jumlah(SPRITE, SPRITE))

    def test_noisy_model_transcript(self):
        # Misspellings from the model's greedy decode.
        self.assertIsNone(parse_jumlah('beras rojolele lima kilogam', BERAS))
        self.assertIsNone(parse_jumlah('beras rojolle lima kilogrm', BERAS))
        self.assertIsNone(parse_jumlah('sprite satu litr', SPRITE))
        self.assertIsNone(parse_jumlah('kaki tiga larutan lima ratu mililiter', KAKI_TIGA))
        # Heard on the live recordings (Pengukuran/*/09_beras-maknyuss...).
        self.assertIsNone(parse_jumlah('kelras saknyuss lima kilurau', MAKNYUSS))
        self.assertIsNone(parse_jumlah('keras maknyuss lima kilo ramupa', MAKNYUSS))

    def test_unit_said_differently(self):
        self.assertIsNone(parse_jumlah('beras rojolele lima kilo', BERAS))
        self.assertIsNone(parse_jumlah('beras rojolele 5 kg', BERAS))
        self.assertIsNone(parse_jumlah('Sprite 1 liter', SPRITE))

    def test_without_produk_unchanged(self):
        # The old behaviour is still what callers get without a product name.
        self.assertEqual(parse_jumlah(BERAS), 5)
        self.assertEqual(parse_jumlah(SPRITE), 1)


class QtyWithStrongUnit(unittest.TestCase):

    def test_after_name(self):
        self.assertEqual(parse_jumlah(f'jual {BERAS} dua bungkus', BERAS), 2)
        self.assertEqual(parse_jumlah(f'{BIMOLI} tiga botol', BIMOLI), 3)
        self.assertEqual(parse_jumlah(
            f'jual {KAKI_TIGA} empat botol dua puluh ribu', KAKI_TIGA), 4)

    def test_same_number_as_size(self):
        self.assertEqual(parse_jumlah(f'{GULA} tiga bungkus', GULA), 3)
        self.assertEqual(parse_jumlah(f'{SPRITE} satu botol', SPRITE), 1)

    def test_size_left_out(self):
        # 'botol' is not the 'liter' of the name, so 'dua' is the quantity.
        self.assertEqual(parse_jumlah('jual bimoli minyak goreng dua botol', BIMOLI), 2)
        self.assertEqual(parse_jumlah('jual sprite satu kaleng', SPRITE), 1)
        self.assertEqual(parse_jumlah('gula pasir tiga pak', GULA), 3)

    def test_digits(self):
        self.assertEqual(parse_jumlah('Sprite 1 liter 3 botol', SPRITE), 3)
        self.assertEqual(parse_jumlah('beras rojolele 5 kg 2 karung', BERAS), 2)

    def test_run_at_end_of_name(self):
        self.assertEqual(parse_jumlah(f'{SAMPOERNA} dua bungkus', SAMPOERNA), 2)


class QtyAtStart(unittest.TestCase):

    def test_qty_before_name(self):
        self.assertEqual(parse_jumlah(f'dua {SPRITE}', SPRITE), 2)
        self.assertEqual(parse_jumlah(f'tiga {KELINCI}', KELINCI), 3)
        self.assertEqual(parse_jumlah(f'jual empat {GULA}', GULA), 4)

    def test_same_number_as_size(self):
        self.assertEqual(parse_jumlah(f'lima {BERAS}', BERAS), 5)
        self.assertEqual(parse_jumlah(f'dua {BIMOLI}', BIMOLI), 2)


class QtyAtEnd(unittest.TestCase):

    def test_qty_after_name(self):
        # 'karung' is not a known unit word.
        self.assertEqual(parse_jumlah(f'{BERAS} dua karung', BERAS), 2)
        self.assertEqual(parse_jumlah(f'{SPRITE} tiga', SPRITE), 3)
        self.assertEqual(parse_jumlah(f'{KAKI_TIGA} dua', KAKI_TIGA), 2)

    def test_same_number_as_size(self):
        self.assertEqual(parse_jumlah(f'{KELINCI} dua', KELINCI), 2)
        self.assertEqual(parse_jumlah(f'{BERAS} lima', BERAS), 5)

    def test_size_left_out(self):
        # 'karung' is not a size unit, so 'lima' is five sacks.
        self.assertEqual(parse_jumlah('beras rojolele lima karung', BERAS), 5)

    def test_size_without_unit_is_a_quantity(self):
        # Without the unit nothing ties the number to the name.
        self.assertEqual(parse_jumlah('gula pasir tiga', GULA), 3)
        self.assertEqual(parse_jumlah('sprite dua', SPRITE), 2)


if __name__ == '__main__':
    unittest.main()
