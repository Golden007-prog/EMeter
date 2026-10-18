"""CGE bill layout and provider-specific metadata."""
import re

from bill_models import ProviderParser, chilean_number


class CgeParser(ProviderParser):
    provider = "CGE"

    def extract(self, context, result):
        self._extract_reading_table(context, result)
        self._extract_customer(context, result)
        self._extract_metadata(context, result)
        self._extract_charges(context, result)
        self._extract_artifacts(context, result)

    @staticmethod
    def _extract_reading_table(context, result):
        pattern = re.compile(r"actual\s+anterior\s+([\d][\d.,]*)\s*kwh\s*-\s*([\d][\d.,]*)\s*kwh")
        for page_index, page in enumerate(context.normalized_pages):
            for match in pattern.finditer(page):
                result.propose("currentReading", chilean_number(match[1]), match[1], "decimal",
                               "provider:CGE", page_index + 1, "kWh")
                result.propose("previousReading", chilean_number(match[2]), match[2], "decimal",
                               "provider:CGE", page_index + 1, "kWh")

    @staticmethod
    def _extract_customer(context, result):
        pattern = re.compile(r"(?<![\d.-])(\d{6,10})\s+fecha\s+de\s+emision")
        for page_index, page in enumerate(context.normalized_pages):
            for match in pattern.finditer(page):
                result.propose("customerNumber", match[1], match[1], source="provider:CGE",
                               page=page_index + 1)

    @staticmethod
    def _extract_metadata(context, result):
        specs = {
            "serviceAddress": r"direccion\s+suministro\s*:\s*(.+?)\s+sector\s+tarifario\s*:",
            "tariffSector": r"sector\s+tarifario\s*:\s*(.+?)\s+potencia\s+conectada\s*:",
            "connectedPower": r"potencia\s+conectada\s*:\s*([\d.,]+)",
            "contractedTariff": r"tipo\s+de\s+tarifa\s+contratada\s*:\s*([^\r\n]+)",
            "route": r"ruta\s*:\s*([^|\r\n]+)",
        }
        for key, pattern in specs.items():
            for page_index, folded_page in enumerate(context.folded_pages):
                match = re.search(pattern, folded_page, re.IGNORECASE | re.DOTALL)
                if match:
                    result.add_metadata(key, context.original_group(page_index, match))
                    break
        if "connectedPower" in result.metadata:
            result.add_metadata("connectedPowerUnit", "kW")

        for page in context.normalized_pages:
            table = re.search(
                r"medidor\s+propiedad\s+lecturas\s+constante\s+consumo\s+medidor\s+"
                r"(\d{6,})\s+([a-z]+).*?\s(\d+(?:[.,]\d+)?)\s+\d[\d.,]*\s*kwh",
                page, re.DOTALL)
            if table:
                result.add_metadata("meterNumber", table[1])
                result.add_metadata("meterOwnership", table[2].title())
                result.add_metadata("meterConstant", chilean_number(table[3]))
                break

        date_specs = {
            "nextEstimatedReadingDate": r"fecha\s+estimada\s+proxima\s+lectura\s*:\s*(\d{1,2}/\d{1,2}/\d{4})",
            "cutoffDate": r"corte\s+a\s+partir\s+de\s+(\d{1,2}/\d{1,2}/\d{4})",
        }
        for key, pattern in date_specs.items():
            for page in context.dated_pages:
                match = re.search(pattern, page)
                if match:
                    result.add_metadata(key, match[1])
                    break

        last_payment = re.search(
            r"ultimo\s+pago\s*:\s*el\s+(\d{1,2}/\d{1,2}/\d{4})\s+por\s+un\s+monto\s+de\s+\$\s*([\d.,]+)",
            "\n".join(context.dated_pages))
        if last_payment:
            result.add_metadata("lastPaymentDate", last_payment[1])
            result.add_metadata("lastPaymentAmount", chilean_number(last_payment[2]))
            result.add_metadata("lastPaymentCurrency", "CLP")

        comparisons = (
            ("sameMonthLastYearVariationPercent", r"aproximadamente\s+(\d+)%\s+(mas|menos).*?mismo\s+mes\s+del\s+ano\s+pasado"),
            ("previousMonthVariationPercent", r"mes\s+pasado\s+este\s+mes\s+consumiste\s+aproximadamente\s+(\d+)%\s+(mas|menos)"),
        )
        for key, pattern in comparisons:
            match = re.search(pattern, context.normalized_text, re.DOTALL)
            if match:
                sign = "-" if match[2] == "menos" else ""
                result.add_metadata(key, f"{sign}{match[1]}")

    @staticmethod
    def _extract_charges(context, result):
        charge_specs = (
            ("Administración del servicio", "serviceAdministration", r"administracion\s+del\s+servicio\s*\$\s*([\d][\d.,]*)"),
            ("Transporte de electricidad", "electricityTransport", r"transporte\s+de\s+electricidad\s*\$\s*([\d][\d.,]*)"),
            ("Electricidad consumida", "consumedElectricity", r"electricidad\s+consumida\s*\([^)]*\)\s*\$\s*([\d][\d.,]*)"),
            ("Interés", "interest", r"interes\s*\$\s*([\d][\d.,]*)"),
            ("Ajuste mes anterior", "cashRounding", r"ajuste\s+para\s+facilitar\s+el\s+pago\s+en\s+efectivo,?\s+mes\s+anterior\s*\$\s*([\d][\d.,]*)"),
            ("Ajuste mes actual", "cashRounding", r"ajuste\s+para\s+facilitar\s+el\s+pago\s+en\s+efectivo,?\s+mes\s+actual\s*\$\s*(-?\s*[\d][\d.,]*)"),
            ("Repactación de deuda anterior", "debtAgreement", r"repactacion\s+de\s+deuda\s+anterior\s+cuota\s+\d+\s+de\s+\d+\s*\$\s*([\d][\d.,]*)"),
        )
        for page_index, page in enumerate(context.normalized_pages):
            for description, category, pattern in charge_specs:
                match = re.search(pattern, page)
                if match:
                    result.add_charge(description, chilean_number(match[1]), page_index + 1, category)

    @staticmethod
    def _extract_artifacts(context, result):
        for page_index, page in enumerate(context.normalized_pages):
            for match in re.finditer(r"(?<!\d)(\d{25,40})(?!\d)", page):
                result.add_artifact({
                    "type": "barcode", "format": "paymentCode", "value": match[1],
                    "title": "Código de pago", "page": page_index + 1, "status": "decodedFromText",
                })
            if "timbre electronico" in page:
                result.add_artifact({
                    "type": "taxStamp", "format": "SII", "value": None,
                    "title": "Timbre electrónico SII", "page": page_index + 1, "status": "detected",
                })
            if "cual fue mi consumo en los ultimos 13 meses" in page:
                result.add_artifact({
                    "type": "chart", "format": "consumptionHistory", "value": None,
                    "title": "Consumo de los últimos 13 meses", "page": page_index + 1, "status": "detected",
                })
            for match in re.finditer(r"\b(?:https?://)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:/\S*)?", page):
                result.add_artifact({
                    "type": "verificationUrl", "format": "url", "value": match[0].rstrip(".,;)"),
                    "title": "URL de verificación", "page": page_index + 1, "status": "decodedFromText",
                })
