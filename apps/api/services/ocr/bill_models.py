"""Shared document model used by common and provider-specific bill parsers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import re
import unicodedata


MONTHS = {month: index for index, month in enumerate(
    ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"), 1)}
MONTHS["sept"] = 9


def fold_text(value):
    """Remove accents while preserving character positions for normal Latin text."""
    return "".join(character for character in unicodedata.normalize("NFD", value)
                   if unicodedata.category(character) != "Mn")


def normalize_text(value):
    return fold_text(value).lower()


def numeric_dates(value):
    pattern = r"\b(\d{1,2})\s+(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + r")\.?\s+(\d{4})\b"
    return re.sub(pattern, lambda match: f"{int(match[1]):02d}/{MONTHS[match[2]]:02d}/{match[3]}", value)


def chilean_number(value):
    compact = value.replace(" ", "")
    negative = compact.startswith("-")
    compact = compact.lstrip("+-").replace(".", "").replace(",", ".")
    return f"-{compact}" if negative else compact


def compact_text(value):
    return " ".join(value.split()).strip(" :-")


@dataclass(frozen=True)
class DocumentContext:
    pages: tuple[str, ...]
    folded_pages: tuple[str, ...]
    normalized_pages: tuple[str, ...]
    dated_pages: tuple[str, ...]

    @classmethod
    def from_pages(cls, pages):
        raw_pages = tuple(pages)
        folded = tuple(fold_text(page) for page in raw_pages)
        normalized = tuple(page.lower() for page in folded)
        return cls(raw_pages, folded, normalized, tuple(numeric_dates(page) for page in normalized))

    @property
    def text(self):
        return "\n".join(self.pages)

    @property
    def normalized_text(self):
        return "\n".join(self.normalized_pages)

    def original_group(self, page_index, match, group=1):
        start, end = match.span(group)
        return self.pages[page_index][start:end]


@dataclass(frozen=True)
class FieldProposal:
    value: str
    raw_value: str
    data_type: str
    source: str
    page: int | None = None
    unit: str | None = None
    confidence: float | None = None

    def as_dict(self):
        return {
            "value": self.value,
            "rawValue": self.raw_value,
            "dataType": self.data_type,
            "source": self.source,
            "page": self.page,
            "unit": self.unit,
            "confidence": self.confidence,
        }


@dataclass
class BillExtraction:
    page_count: int
    provider: str | None = None
    proposals: dict[str, list[FieldProposal]] = field(default_factory=dict)
    metadata: dict[str, str] = field(default_factory=dict)
    readings: list[dict] = field(default_factory=list)
    charges: list[dict] = field(default_factory=list)
    artifacts: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)

    def propose(self, key, value, raw_value=None, data_type="string", source="common",
                page=None, unit=None, confidence=None):
        if value is None or str(value).strip() == "":
            return
        proposal = FieldProposal(str(value), str(raw_value if raw_value is not None else value),
                                 data_type, source, page, unit, confidence)
        candidates = self.proposals.setdefault(key, [])
        if proposal not in candidates:
            candidates.append(proposal)

    def add_metadata(self, key, value):
        if value is not None and str(value).strip():
            self.metadata.setdefault(key, compact_text(str(value)))

    def add_charge(self, description, amount, page, category=None, currency="CLP"):
        charge = {"description": compact_text(description), "amount": amount, "currency": currency,
                  "category": category, "page": page}
        if charge not in self.charges:
            self.charges.append(charge)

    def add_artifact(self, artifact):
        identity = (artifact.get("type"), artifact.get("format"), artifact.get("value"), artifact.get("page"))
        if not any((item.get("type"), item.get("format"), item.get("value"), item.get("page")) == identity
                   for item in self.artifacts):
            self.artifacts.append(artifact)

    def _legacy_fields(self):
        fields = {}
        for key, candidates in self.proposals.items():
            values = list(dict.fromkeys(candidate.value for candidate in candidates))
            if len(values) == 1:
                fields[key] = values[0]
            elif len(values) > 1:
                warning = {
                    "code": "conflictingCandidates",
                    "message": f"Multiple values were proposed for {key}; review the candidates.",
                    "field": key,
                }
                if warning not in self.warnings:
                    self.warnings.append(warning)
        return fields

    def add_reading_summary(self, fields):
        if self.readings or not any(key in fields for key in ("currentReading", "previousReading", "consumption")):
            return
        pages = [candidate.page for key in ("currentReading", "previousReading", "consumption")
                 for candidate in self.proposals.get(key, []) if candidate.page is not None]
        self.readings.append({
            "meterNumber": self.metadata.get("meterNumber"),
            "ownership": self.metadata.get("meterOwnership"),
            "currentValue": fields.get("currentReading"),
            "previousValue": fields.get("previousReading"),
            "consumption": fields.get("consumption"),
            "unit": fields.get("unit"),
            "constant": self.metadata.get("meterConstant"),
            "period": fields.get("period"),
            "page": min(pages) if pages else None,
        })

    def as_dict(self):
        fields = self._legacy_fields()
        if "totalAmount" in fields:
            fields.setdefault("currency", "CLP")
        document = {
            "type": "utilityBill",
            "provider": self.provider,
            "pageCount": self.page_count,
            "documentNumber": fields.get("documentNumber"),
        }
        self.add_reading_summary(fields)
        return {
            "schemaVersion": 2,
            "document": document,
            "fields": fields,
            "proposals": {key: [proposal.as_dict() for proposal in values]
                          for key, values in self.proposals.items()},
            "metadata": self.metadata,
            "readings": self.readings,
            "charges": self.charges,
            "artifacts": self.artifacts,
            "warnings": self.warnings,
        }


class ProviderParser(ABC):
    provider: str
    aliases: tuple[str, ...] = ()

    def matches(self, context):
        names = (self.provider, *self.aliases)
        return any(normalize_text(name) in context.normalized_text for name in names)

    @abstractmethod
    def extract(self, context, result):
        """Add provider-specific proposals and metadata to result."""
