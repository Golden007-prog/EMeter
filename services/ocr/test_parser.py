import unittest
from parser import extract_fields


class BillParserTests(unittest.TestCase):
    def test_chilean_bill_preserves_distinct_values(self):
        fields = extract_fields("""Enel
Número de cliente: 1234567
Boleta electrónica N° 555123
Lectura anterior: 12.345,5
Lectura actual: 12.400,5
Consumo facturado: 55 kWh
Total a pagar: $18.990
Saldo anterior: $1.000
Vencimiento: 20/10/2026""")
        self.assertEqual(fields["currentReading"], "12400.5")
        self.assertEqual(fields["previousReading"], "12345.5")
        self.assertEqual(fields["consumption"], "55")
        self.assertEqual(fields["totalAmount"], "18990")
        self.assertEqual(fields["previousDebt"], "1000")
        self.assertEqual(fields["documentNumber"], "555123")
        self.assertEqual(fields["unit"], "kWh")

    def test_consumption_is_not_a_meter_reading(self):
        fields = extract_fields("Essbio\nConsumo: 18 m³\nTotal a pagar $9.000")
        self.assertEqual(fields["consumption"], "18")
        self.assertNotIn("currentReading", fields)

    def test_conflicting_proposals_are_omitted(self):
        self.assertNotIn("totalAmount", extract_fields("Total a pagar: $1.000\nTotal a pagar: $2.000"))


if __name__ == "__main__":
    unittest.main()
