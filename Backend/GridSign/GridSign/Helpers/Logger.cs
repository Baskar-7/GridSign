namespace GridSign.Helpers;  
using Serilog;

public enum LoggLevel
{
    Debug,
    Info,
    Warn,
    Error
}

public static class Logger
{
    public static void Logg(LoggLevel level, string message, Exception? ex = null)
    {
        switch (level)
        {
            case LoggLevel.Debug:
                Log.Debug(message);
                break;
            case LoggLevel.Info:
                Log.Information(message);
                break;
            case LoggLevel.Warn:
                Log.Warning(message);
                break;
            case LoggLevel.Error:
                if (ex != null)
                    Log.Error(ex, message);
                else
                    Log.Error(message);
                break;
            default:
                Log.Information(message);
                break;
        }
    }
}
