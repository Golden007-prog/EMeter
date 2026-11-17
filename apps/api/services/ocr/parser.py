"""Structured, conservative proposals for Chilean utility bills."""
from dataclasses import dataclass
import re

from bill_models import BillExtraction, DocumentContext, chilean_number, normalize_text
from bill_providers import find_provider


@dataclass(frozen=True)
class FieldRule:
    key: str
    pattern: str
    data_type: str = "string"
    numeric: bool = False


COMMON_RULES = (
    FieldRule("customerNumber", r"(?:numero\s+de\s+cliente|n[°ºo.]?\s*(?:de\s+)?cliente|cuenta\s+contrato)\s*[:#-]?\s*([\d.-]+)"),
    FieldRule("documentNumber", r"(?:boleta\s*(?:electronica)?\s*(?:n[°ºo.]?)?|folio)\s*[:#-]?\s*([\d.-]+)"),
    FieldRule("previousReading", r"lectura\s+anterior\s*[:=]?\s*([\d][\d.,]*)", "decimal", True),
    FieldRule("currentReading", r"lectura\s+actual\s*[:=]?\s*([\d][\d.,]*)", "decimal", True),
    FieldRule("consumption", r"consumo(?:\s+total)?(?:\s+(?:facturado|del\s+mes))?(?:\s*\((?:kwh|m3|m³)\))?\s*[:=]?\s*([\d][\d.,]*)", "decimal", True),
    FieldRule("totalAmount", r"total\s+a\s+pagar\s*[:=]?\s*\$?\s*([\d][\d.,]*)", "money", True),
    FieldRule("previousDebt", r"(?:saldo|deuda)\s+anterior\s*[:=]?\s*\$?\s*([\d][\d.,]*)", "money", True),
    FieldRule("dueDate", r"(?:fecha\s+de\s+vencimiento|vencimiento|vencer?)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})", "date"),
    FieldRule("issueDate", r"(?:fecha\s+de\s+emision|emision)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})", "date"),
    FieldRule("period", r"periodo(?:\s+de\s+(?:consumo|facturacion|lectura))?\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*(?:al|a|-)\s*\d{1,2}[-/]\d{1,2}[-/]\d{4})", "dateRange"),
)


class CommonBillParser:
    def extract(self, context, result):
        unit = self._unit(context.normalized_text)
        for page_index, page in enumerate(context.dated_pages):
            for rule in COMMON_RULES:
                for match in re.finditer(rule.pattern, page):
                    raw_value = match[1]
                    value = chilean_number(raw_value) if rule.numeric else raw_value
                    proposal_unit = unit if rule.key in ("previousReading", "currentReading", "consumption") else None
                    result.propose(rule.key, value, raw_value, rule.data_type, "common",
                                   page_index + 1, proposal_unit)
        if unit:
            result.propose("unit", unit, unit, source="common")
        if result.proposals.get("totalAmount"):
            result.propose("currency", "CLP", "CLP", source="common")

    @staticmethod
    def _unit(normalized):
        match = re.search(r"\b(kwh|m3|m³)\b", normalized)
        return "kWh" if match and match[1] == "kwh" else "m3" if match else None


def parse_bill(pages):
    """Return the versioned structured result for one or more document pages."""
    context = DocumentContext.from_pages(pages)
    provider, provider_parser = find_provider(context)
    result = BillExtraction(len(context.pages), provider)
    CommonBillParser().extract(context, result)
    if provider_parser:
        provider_parser.extract(context, result)
    if provider:
        result.propose("provider", provider, provider, source="classifier")
    return result.as_dict()


def extract_fields(text):
    """Backward-compatible facade used by existing callers and tests."""
    return parse_bill((text,))["fields"]


# Kept as public helpers for compatibility with earlier parser imports.
normalize = normalize_text
