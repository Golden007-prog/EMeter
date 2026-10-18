namespace CleanMinimalApi.Application.Tests.Unit.Extraction;

using System.Text.Json;
using CleanMinimalApi.Application.Extraction;
using Shouldly;
using Xunit;

public class ExtractedBillSerializationTests
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public void StructuredResult_ShouldDeserialize_WithoutLosingLegacyFields()
    {
        const string json = """
            {
              "text": "CGE",
              "fields": { "currentReading": "3746" },
              "confidence": null,
              "engine": "pdf-text",
              "schemaVersion": 2,
              "document": { "type": "utilityBill", "provider": "CGE", "pageCount": 3, "documentNumber": "497629545" },
              "proposals": {
                "currentReading": [
                  { "value": "3746", "rawValue": "3.746", "dataType": "decimal", "source": "provider:CGE", "page": 2, "unit": "kWh", "confidence": null }
                ]
              },
              "metadata": { "meterNumber": "220220253" },
              "readings": [
                { "meterNumber": "220220253", "ownership": "Empresa", "currentValue": "3746", "previousValue": "3432", "consumption": "314", "unit": "kWh", "constant": "1", "period": "20/08/2026 - 16/09/2026", "page": 2 }
              ],
              "charges": [],
              "artifacts": [
                { "type": "qr", "format": "QR Code", "value": "https://example.test", "title": "Código detectado", "page": 1, "status": "decoded" }
              ],
              "warnings": []
            }
            """;

        var result = JsonSerializer.Deserialize<ExtractedBill>(json, SerializerOptions);

        result.ShouldNotBeNull();
        result.SchemaVersion.ShouldBe(2);
        result.Fields["currentReading"].ShouldBe("3746");
        result.Document!.Provider.ShouldBe("CGE");
        result.Proposals!["currentReading"][0].Page.ShouldBe(2);
        result.Readings![0].MeterNumber.ShouldBe("220220253");
        result.Artifacts![0].Type.ShouldBe("qr");
    }
}
