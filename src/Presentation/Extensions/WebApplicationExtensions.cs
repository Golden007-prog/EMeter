namespace CleanMinimalApi.Presentation.Extensions;

using System.Diagnostics.CodeAnalysis;
using CleanMinimalApi.Presentation.Endpoints;
using Microsoft.AspNetCore.Builder;
using Serilog;

[ExcludeFromCodeCoverage]
public static class WebApplicationExtensions
{
    public static WebApplication ConfigureApplication(this WebApplication app)
    {
        app.UseMiddleware<ApiExceptionMiddleware>();
        app.UseStatusCodePages(async status =>
        {
            await Results.Problem(statusCode: status.HttpContext.Response.StatusCode).ExecuteAsync(status.HttpContext);
        });
        app.UseCors();
        app.MapExtractionEndpoints();
        app.MapCatalogEndpoints();
        app.MapGet("/health", () => Results.Ok(new { status = "ok" })).ExcludeFromDescription();

        #region Logging

        _ = app.UseHttpLogging();
        _ = app.UseSerilogRequestLogging();

        #endregion Logging

        #region Security

        _ = app.UseHsts();

        #endregion Security

        #region API Configuration

        _ = app.UseHttpsRedirection();

        #endregion API Configuration

        #region Swagger

        _ = app.MapOpenApi();
        _ = app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "CleanMinimalApi API v1"));

        #endregion Swagger

        #region MinimalApi

        _ = app.MapVersionEndpoints();
        _ = app.MapReadingEndpoints();
        _ = app.MapEvidenceEndpoints();
        _ = app.MapReportEndpoints();

        #endregion MinimalApi

        return app;
    }
}
