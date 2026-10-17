namespace CleanMinimalApi.Presentation.Extensions;

using Application.Common.Exceptions;
using FluentValidation;

public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        { await next(context); }
        catch (ValidationException ex)
        {
            context.Response.StatusCode = 400;
            await Results.ValidationProblem((ex.Errors.Any() ? ex.Errors : [new FluentValidation.Results.ValidationFailure("request", ex.Message)]).GroupBy(x => x.PropertyName)
                .ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray())).ExecuteAsync(context);
        }
        catch (NotFoundException ex) { await Results.Problem(statusCode: 404, detail: ex.Message).ExecuteAsync(context); }
        catch (BadHttpRequestException ex) { await Results.Problem(statusCode: ex.StatusCode, detail: ex.Message).ExecuteAsync(context); }
        catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException) { await Results.Problem(statusCode: 409, detail: "Data changed; reload before saving.").ExecuteAsync(context); }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        { await Results.Problem(statusCode: 409, detail: "A record with the same key already exists.").ExecuteAsync(context); }
        catch (ConflictException ex) { await Results.Problem(statusCode: 409, detail: ex.Message).ExecuteAsync(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception ex)
        {
            logger.LogError(ex, "Request failed: {Path}", context.Request.Path);
            await Results.Problem(statusCode: 500, detail: "An unexpected error occurred.").ExecuteAsync(context);
        }
    }
}
