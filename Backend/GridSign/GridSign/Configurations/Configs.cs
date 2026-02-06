using GridSign.Helpers;
using MySql.Data.MySqlClient;

namespace GridSign.Configurations;

public static class Configs
{
    public static IConfiguration JwtSettings { get; set; }
    public static string? MailCredential { get; set; }
    public static string? DbConnectionUrl { get; set; }
    public static string? QuartzDbConnectionUrl { get; set; }
    
    public static void LoadConfigs(IConfiguration config)
    { 
        //load QuartzDb url google_drive_oauth_credentials.json
        QuartzDbConnectionUrl = config.GetConnectionString("QuartzDbConnection");
        
        //populate quartz tables from the scripts
        EnsureQuartzTablesExist();
        
        //load Application DB url
        DbConnectionUrl = config.GetConnectionString("DefaultConnection"); 
        
        //load Mail credentials
        MailCredential = config.GetSection("MailConfigs")["Credential"]; 
        
        //load the jwt setting 
        JwtSettings = config.GetSection("JwtSettings"); 
    }
    
    private static void EnsureQuartzTablesExist()
    {
        using var connection = new MySqlConnection("Server=localhost;Port=3306;User=root;Password=Stonebreaker;");
        connection.Open();
        
        var checkDbCmd = new MySqlCommand("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'quartznet';", connection);
        var dbExists = checkDbCmd.ExecuteScalar() != null;

        if (dbExists) {
            Logger.Logg(LoggLevel.Info, "Quartz database already exists. Skipping script execution."); 
            return;
        }  
        
        //create database 
        var createDbCmd = new MySqlCommand("CREATE DATABASE quartznet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;", connection);
        createDbCmd.ExecuteNonQuery();
          
        connection.ChangeDatabase("quartznet");
        var scriptPath = Path.Combine("../GridSign/Configurations/Scripts/quartz_table_schema.sql");
        var script = File.ReadAllText(scriptPath);
        var commands = script.Split(";", StringSplitOptions.RemoveEmptyEntries);
        foreach (var cmd in commands)
        {
            var trimmed = cmd.Trim();
            if (string.IsNullOrWhiteSpace(trimmed)) continue;

            using var command = new MySqlCommand(trimmed, connection);
            command.ExecuteNonQuery();
        }

        Logger.Logg(LoggLevel.Info, "Quartz tables and database created successfully.");
    }

}