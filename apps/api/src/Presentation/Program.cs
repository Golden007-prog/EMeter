using CleanMinimalApi.Presentation.Extensions;
using Serilog;
using CleanMinimalApi.Infrastructure;

var builder = WebApplication
    .CreateBuilder(args)
    .ConfigureApplicationBuilder();

var app = builder
    .Build()
    .ConfigureApplication();

try
{
    Log.Information("Starting host");
    await app.Services.InitializeInfrastructureAsync();
    await app.RunAsync();
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
    return 1;
}
finally
{
    Log.CloseAndFlush();
}
