import unittest
from parser import extract_fields, parse_bill


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

    def test_conflicting_proposals_are_preserved_for_review(self):
        result = parse_bill(("Total a pagar: $1.000\nTotal a pagar: $2.000",))
        self.assertEqual(["1000", "2000"], [item["value"] for item in result["proposals"]["totalAmount"]])
        self.assertEqual("conflictingCandidates", result["warnings"][0]["code"])
        self.assertEqual("totalAmount", result["warnings"][0]["field"])

    def test_cge_bill_uses_provider_specific_reading_layout(self):
        fields = extract_fields("""CGE
Boleta Electronica N 497629545
9723261
Fecha de emision: 21 Sep 2026
Total a pagar $140.900
Fecha de vencimiento 08 Oct 2026
Periodo de lectura: 20/08/2026 - 16/09/2026
Actual
Anterior
3.746 kWh
- 3.432 kWh
314 kWh
Consumo total del mes = 314 kWh""")
        self.assertEqual(fields["provider"], "CGE")
        self.assertEqual(fields["customerNumber"], "9723261")
        self.assertEqual(fields["documentNumber"], "497629545")
        self.assertEqual(fields["currentReading"], "3746")
        self.assertEqual(fields["previousReading"], "3432")
        self.assertEqual(fields["consumption"], "314")
        self.assertEqual(fields["period"], "20/08/2026 - 16/09/2026")
        self.assertEqual(fields["issueDate"], "21/09/2026")
        self.assertEqual(fields["dueDate"], "08/10/2026")
        self.assertEqual(fields["totalAmount"], "140900")

    def test_cge_layout_is_not_applied_to_other_providers(self):
        fields = extract_fields("""Essbio
1234567
Fecha de emision: 21/09/2026
Actual Anterior
3.746 kWh - 3.432 kWh""")
        self.assertEqual(fields["provider"], "Essbio")
        self.assertNotIn("customerNumber", fields)
        self.assertNotIn("currentReading", fields)
        self.assertNotIn("previousReading", fields)

    def test_cge_structured_result_preserves_bill_metadata(self):
        result = parse_bill(("""CGE
Dirección suministro: Avenida Uno 123
Sector Tarifario: Buin Stxe-6-a - Tramo: 6
Potencia Conectada: 8.80
Tipo de tarifa contratada: BT1
Ruta: G1514004-1082 | Var.
Boleta Electrónica N° 497629545
9723261
Fecha de emisión: 21 Sep 2026
Total a pagar $140.900
04011547984139972326100001409001
Timbre Electrónico S.I.I.
Verifique documento: www.sii.cl""", """Mi consumo en el mes actual
Período de lectura: 20/08/2026 - 16/09/2026
Fecha estimada próxima lectura: 20/10/2026
Medidor Propiedad Lecturas Constante Consumo medidor
220220253 Empresa Actual Anterior 3.746 kWh - 3.432 kWh 314 kWh 1 314 kWh
Consumo total del mes = 314 kWh
¿Cuál fue mi consumo en los últimos 13 meses?
Administración del servicio $ 1.064"""))
        self.assertEqual(2, result["schemaVersion"])
        self.assertEqual(2, result["document"]["pageCount"])
        self.assertEqual("Avenida Uno 123", result["metadata"]["serviceAddress"])
        self.assertEqual("BT1", result["metadata"]["contractedTariff"])
        self.assertEqual("220220253", result["metadata"]["meterNumber"])
        self.assertEqual(2, result["proposals"]["currentReading"][0]["page"])
        self.assertEqual("1064", result["charges"][0]["amount"])
        self.assertTrue(any(item["type"] == "barcode" for item in result["artifacts"]))
        self.assertTrue(any(item["type"] == "chart" for item in result["artifacts"]))


if __name__ == "__main__":
    unittest.main()
