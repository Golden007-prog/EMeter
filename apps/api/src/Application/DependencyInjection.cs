namespace CleanMinimalApi.Application;

using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

[ExcludeFromCodeCoverage]
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        _ = services.AddMediatR(Assembly.GetExecutingAssembly());
        services.AddScoped<Catalog.CatalogDetails>();

        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(Common.ValidationBehavior<,>));
        foreach (var type in Assembly.GetExecutingAssembly().GetTypes().Where(t => !t.IsAbstract))
            foreach (var contract in type.GetInterfaces().Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(FluentValidation.IValidator<>)))
                services.AddTransient(contract, type);
        return services;
    }
}
