namespace CleanMinimalApi.Application.Common.Exceptions;

public sealed class ConflictException(string message) : InvalidOperationException(message);
