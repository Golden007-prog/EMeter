namespace CleanMinimalApi.Application.Evidence.Commands.UploadEvidence;

using System.Security.Cryptography;
using CleanMinimalApi.Application.Evidence.Entities;
using CleanMinimalApi.Application.Storage;
using MediatR;
using Serilog;

public sealed class UploadEvidenceHandler(IEvidenceRepository evidenceRepository, IObjectStorage objectStorage, ILogger logger)
    : IRequestHandler<UploadEvidenceCommand, UploadEvidenceResponse>
{
    private readonly IEvidenceRepository evidenceRepository = evidenceRepository ?? throw new ArgumentNullException(nameof(evidenceRepository));
    private readonly IObjectStorage objectStorage = objectStorage ?? throw new ArgumentNullException(nameof(objectStorage));
    private readonly ILogger logger = logger ?? throw new ArgumentNullException(nameof(logger));

    public async Task<UploadEvidenceResponse> Handle(UploadEvidenceCommand request, CancellationToken cancellationToken)
    {
        this.logger.Information("Uploading evidence file {FileName}", request.FileName);

        var signature = new byte[8];
        request.Content.Position = 0;
        var count = await request.Content.ReadAtLeastAsync(signature, 8, throwOnEndOfStream: false, cancellationToken);
        var valid = request.ContentType switch
        {
            "application/pdf" => count >= 5 && signature.AsSpan(0, 5).SequenceEqual("%PDF-"u8),
            "image/jpeg" => count >= 3 && signature[0] == 0xff && signature[1] == 0xd8 && signature[2] == 0xff,
            "image/png" => count == 8 && signature.AsSpan().SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            _ => false
        };
        if (!valid) throw new FluentValidation.ValidationException("File content does not match the declared PDF/JPEG/PNG type");

        // Calculate hash of the content
        string hash;
        _ = request.Content.Seek(0, SeekOrigin.Begin);
        using (var sha256 = SHA256.Create())
        {
            var hashBytes = await sha256.ComputeHashAsync(request.Content, cancellationToken);
            hash = Convert.ToHexString(hashBytes);
        }

        // Reset stream for upload
        request.Content.Seek(0, SeekOrigin.Begin);

        // Generate storage key
        var fileName = Path.GetFileName(request.FileName.Replace('\\', '/'));
        var storageKey = $"evidence/{Guid.NewGuid()}/{fileName}";

        // Upload to object storage
        var uploadedKey = await this.objectStorage.UploadAsync(request.Content, storageKey, request.ContentType, cancellationToken);

        this.logger.Information("Evidence uploaded to storage key {StorageKey} with hash {Hash}", uploadedKey, hash);

        // Create evidence record
        var evidence = new Evidence
        {
            StorageKey = uploadedKey,
            FileName = fileName,
            ContentType = request.ContentType,
            Hash = hash,
            Metadata = []
        };

        try { await this.evidenceRepository.AddAsync(evidence, cancellationToken); }
        catch
        {
            await this.objectStorage.DeleteAsync(uploadedKey, CancellationToken.None);
            throw;
        }

        this.logger.Information("Evidence record created with id {EvidenceId}", evidence.Id);

        return new UploadEvidenceResponse(evidence.Id, evidence.FileName, evidence.StorageKey, evidence.Hash);
    }
}
