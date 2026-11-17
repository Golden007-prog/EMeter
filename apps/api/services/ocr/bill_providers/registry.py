"""Select a provider parser without containing provider-specific rules."""

from .cge import CgeParser


KNOWN_PROVIDERS = (
    "Enel", "CGE", "Chilquinta", "Saesa", "Frontel", "Edelaysen",
    "Aguas Andinas", "Esval", "Essbio", "Nuevosur", "Smapa", "Metrogas",
    "GasValpo", "Gasco", "Lipigas", "Abastible",
)

PARSERS = (CgeParser(),)


def find_provider(context):
    parser = next((candidate for candidate in PARSERS if candidate.matches(context)), None)
    if parser:
        return parser.provider, parser
    normalized = context.normalized_text
    provider = next((name for name in KNOWN_PROVIDERS if name.lower() in normalized), None)
    return provider, None
