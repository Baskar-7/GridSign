using GridSign.BackgroundServices;
using GridSign.BackgroundServices.Interfaces;
using GridSign.Data;
using GridSign.Mapper;
using GridSign.Repositories.Auth;
using GridSign.Repositories.Auth.Interfaces;
using GridSign.Repositories.Files;
using GridSign.Repositories.Files.Interfaces;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.SignWorkFlow;
using GridSign.Repositories.SignWorkFlow.Interfaces;
using GridSign.Repositories.SigningToken;
using GridSign.Repositories.Templates;
using GridSign.Repositories.Templates.Interfaces;
using GridSign.Repositories.User;
using GridSign.Repositories.User.Interfcae;
using GridSign.Repositories.UserControl.Interfcae;
using GridSign.Repositories.Reports.Interfaces;
using GridSign.Repositories.Reports; 
using GridSign.Repositories.SigningToken.Interfaces;
using GridSign.Services; 
using GridSign.Services.Interfaces;
using GridSign.Services.ServiceHelper;
using GridSign.Services.ServiceHelper.Interfaces;

namespace GridSign.Configurations;
using Microsoft.Extensions.DependencyInjection;

public static class ServiceRegistrations
{
    public static IServiceCollection  AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<ApplicationDbContext>();
        services.AddScoped<IUserContext, UserContext>();
        services.AddAutoMapper(typeof(AutoMappers));
        
        services.AddHostedService<BackgroundWorkerService>(); 
         
        services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();   
        
        services.AddScoped<RepoUtility>();
        services.AddScoped<IAuthUpdateRepository,AuthUpdateRepository>();
        services.AddScoped<IAuthViewRepository,AuthViewRepository>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ISigningWorkflowService,SigningWorkflowService>();
        services.AddScoped<ISignWorkFlowUpdateRepo,SignWorkFlowUpdateRepo>();
        services.AddScoped<ISignWorkFlowViewRepo,SignWorkFlowViewRepo>(); 
        services.AddScoped<ISigningTokenRepository, SigningTokenRepository>();
        services.AddScoped<IUserService , UserService>();
        services.AddScoped<IUserUpdateRepo, UserUpdateRepo>();
        services.AddScoped<IUserViewRepo, UserViewRepo>();
        services.AddScoped<ITemplateService, TemplateService>();
        services.AddScoped<ITemplateViewRepo, TemplateViewRepo>();
        services.AddScoped<ITemplateUpdateRepo, TemplateUpdateRepo>();
        services.AddScoped<IFileResourceService, FileResourceService>();
        services.AddScoped<IFileViewRepo, FileViewRepo>();
        services.AddScoped<ServiceUtility>(); 
        services.AddScoped<IReportsService, ReportsService>();
        services.AddScoped<IReportsViewRepo, ReportsViewRepo>();
        // Register more services here...

        return services;
    }
     
}
 