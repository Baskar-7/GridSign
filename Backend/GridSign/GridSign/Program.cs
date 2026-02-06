using System.Text; 
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using GridSign.Configurations;
using GridSign.Data;
using Quartz;
using Serilog;

var builder = WebApplication.CreateBuilder(args); 

//Logger Configurations
Log.Logger = new LoggerConfiguration() 
    .WriteTo.Console()
    .WriteTo.File("Logs/gridsign-log-.txt", rollingInterval: RollingInterval.Day) 
    .CreateLogger();Log.Information("Logger is configured and working.");
builder.Host.UseSerilog();

// Add services to the container.
builder.Services.AddApplicationServices(); 
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

builder.Services.AddEndpointsApiExplorer(); 
builder.Services.AddSwaggerGen();

//Prevent infinite recursion and keeps all object links intact(linq).
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.Preserve;
        options.JsonSerializerOptions.WriteIndented = true;
    });


// Registers and configures Quartz.NET services
builder.Services.AddQuartz(q =>
{
    q.UseMicrosoftDependencyInjectionJobFactory();
    q.UsePersistentStore(options =>
    {
        options.UseProperties = true;

        options.UseMySql(mysql =>
        {
            mysql.ConnectionString = builder.Configuration.GetConnectionString("QuartzDbConnection");
        });

        options.UseNewtonsoftJsonSerializer();
    });
});

// Register the Quartz background hosted service
builder.Services.AddQuartzHostedService(opt => {
    opt.WaitForJobsToComplete = true;
});
 
builder.Services.AddDbContext<ApplicationDbContext>(options => 
    options.UseMySql(builder.Configuration.GetConnectionString("DefaultConnection"), new MySqlServerVersion(new Version(8, 0, 36))));

//load the configurations from the config file
if (!builder.Environment.IsEnvironment("DesignTime"))
    Configs.LoadConfigs(builder.Configuration);

//Fetch Config detials from the appSettings.json and validate the request using the jwt token
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!))
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
    options.AddPolicy("User", policy => policy.RequireRole("User"));
    options.AddPolicy("Signer", policy => policy.RequireRole("Signer", "Admin"));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowDevUrl", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost:5173","http://localhost:3000") // Replace with Angular, React app's URL
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
 
var app = builder.Build();
// Middleware pipeline 
app.UseRouting();
app.UseCors("AllowDevUrl");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger(); 
    app.UseSwaggerUI();
}

//Update Database with the Migrations
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    dbContext.Database.Migrate();
}
  
app.Run();  
