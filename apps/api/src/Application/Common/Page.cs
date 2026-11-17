namespace CleanMinimalApi.Application.Common;

using FluentValidation;

public sealed record Page<T>(IReadOnlyList<T> Items, int PageNumber, int PageSize, int TotalCount)
{
    public bool HasNextPage => (long)PageNumber * PageSize < TotalCount;
}

public static class Paging
{
    public static void Validate(int page, int pageSize)
    {
        if (page < 1 || pageSize < 1 || pageSize > 200 || (long)(page - 1) * pageSize > int.MaxValue)
            throw new ValidationException("Page must be positive and pageSize must be between 1 and 200.");
    }
}
