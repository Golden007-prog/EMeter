namespace CleanMinimalApi.Application.Evidence.Commands.UploadEvidence;

using FluentValidation;

public sealed class UploadEvidenceValidator : AbstractValidator<UploadEvidenceCommand>
{
    public UploadEvidenceValidator()
    {
        RuleFor(x => x.ContentType).Must(x => x is "image/jpeg" or "image/png" or "application/pdf")
            .WithMessage("Only JPEG, PNG and PDF files are supported");
        RuleFor(x => x.Content).Must(s => s != null && s.CanSeek && s.Length > 0 && s.Length <= 20 * 1024 * 1024)
            .WithMessage("File must be seekable and between 1 byte and 20 MiB");
        _ = this.RuleFor(x => x.FileName)
            .NotEmpty()
            .WithMessage("FileName is required")
            .MaximumLength(500)
            .WithMessage("FileName must not exceed 500 characters");

        _ = this.RuleFor(x => x.ContentType)
            .NotEmpty()
            .WithMessage("ContentType is required")
            .MaximumLength(100)
            .WithMessage("ContentType must not exceed 100 characters");

        _ = this.RuleFor(x => x.Content)
            .NotNull()
            .WithMessage("Content stream is required");
    }
}
