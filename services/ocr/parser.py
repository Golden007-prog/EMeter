"""Conservative proposals for Chilean utility bills; never confirms readings."""
import re
import unicodedata

PROVIDERS = ("Enel", "CGE", "Chilquinta", "Saesa", "Frontel", "Edelaysen",
             "Aguas Andinas", "Esval", "Essbio", "Nuevosur", "Smapa", "Metrogas",
             "GasValpo", "Gasco", "Lipigas", "Abastible")


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFD", value.lower())
                   if unicodedata.category(c) != "Mn")


def chilean_number(value):
    # Chilean thousands '.', decimal ','. Ambiguous dots are treated as thousands.
    return value.replace(" ", "").replace(".", "").replace(",", ".")


def extract_fields(text):
    normalized = normalize(text)
    fields = {}
    for provider in PROVIDERS:
        if normalize(provider) in normalized:
            fields["provider"] = provider
            break
    patterns = {
        "customerNumber": r"(?:numero\s+de\s+cliente|n[°ºo.]?\s*(?:de\s+)?cliente|cuenta\s+contrato)\s*[:#-]?\s*([\d.-]+)",
        "documentNumber": r"(?:boleta\s*(?:electronica)?\s*(?:n[°ºo.]?)?|folio)\s*[:#-]?\s*([\d.-]+)",
        "previousReading": r"lectura\s+anterior\s*[:=]?\s*([\d][\d.,]*)",
        "currentReading": r"lectura\s+actual\s*[:=]?\s*([\d][\d.,]*)",
        "consumption": r"consumo(?:\s+(?:total|facturado|del\s+mes))?(?:\s*\((?:kwh|m3|m³)\))?\s*[:=]?\s*([\d][\d.,]*)",
        "totalAmount": r"total\s+a\s+pagar\s*[:=]?\s*\$?\s*([\d][\d.,]*)",
        "previousDebt": r"(?:saldo|deuda)\s+anterior\s*[:=]?\s*\$?\s*([\d][\d.,]*)",
        "dueDate": r"(?:fecha\s+de\s+vencimiento|vencimiento|vencer?)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})",
        "issueDate": r"(?:fecha\s+de\s+emision|emision)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})",
        "period": r"periodo(?:\s+de\s+(?:consumo|facturacion))?\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*(?:al|a|-)\s*\d{1,2}[-/]\d{1,2}[-/]\d{4})",
    }
    numeric = {"previousReading", "currentReading", "consumption", "totalAmount", "previousDebt"}
    for key, pattern in patterns.items():
        matches = re.findall(pattern, normalized)
        # Multiple differing matches need human interpretation, so omit the proposal.
        if matches and len(set(matches)) == 1:
            fields[key] = chilean_number(matches[0]) if key in numeric else matches[0]
    unit = re.search(r"\b(kwh|m3|m³)\b", normalized)
    if unit:
        fields["unit"] = "kWh" if unit[1] == "kwh" else "m3"
    if "totalAmount" in fields:
        fields["currency"] = "CLP"
    return fields
