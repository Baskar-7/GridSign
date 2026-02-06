using System.Data;
using GridSign.Configurations;

namespace GridSign.Repositories.RepoHelper;
using MySql.Data.MySqlClient;  

/// <summary>
/// A helper class to simplify MySQL ADO.NET operations such as executing queries,
/// reading data, and running non-query commands.
/// </summary>
public class BaseRepository
{
    /// Establishes and opens a new MySQL database connection. 
    protected static MySqlConnection GetConnection()
    {
        var connection = new MySqlConnection(Configs.DbConnectionUrl);
        connection.Open();
        return connection;
    }

    /// Executes a SQL statement that does not return any Q (e.g., INSERT, UPDATE, DELETE).
    protected static (int updateRows, long generatedKey) ExecuteNonQuery(string sql, params MySqlParameter[] parameters) {
        using (var connection = GetConnection())
        {
            return ExecuteNonQuery(connection, sql, parameters);
        }
    }
    protected static (int updateRows, long generatedKey) ExecuteNonQuery(MySqlConnection connection,string sql,params MySqlParameter[] parameters)
    { 
        using var command = new MySqlCommand(sql, connection);
        command.Parameters.AddRange(parameters);
        var updateRows = command.ExecuteNonQuery();
        var generatedKey = command.LastInsertedId;
        return (updateRows, generatedKey);
    }

    //Executes a SQL query and returns a single value (e.g., COUNT(*), MAX()).
    protected static object? ExecuteScalar(string sql, params MySqlParameter[] parameters){
        using (var connection = GetConnection())
        {
            return ExecuteScalar(connection, sql, parameters);
        }
    }
    protected static object? ExecuteScalar(MySqlConnection connection,string sql, params MySqlParameter[] parameters)
    { 
        using var command = new MySqlCommand(sql, connection);
        command.Parameters.AddRange(parameters);
        return command.ExecuteScalar();
    }

    // Executes a SQL query that returns a result set (e.g., SELECT) and loads it into a DataTable.
    protected static DataTable ExecuteReader(string sql, params MySqlParameter[] parameters)
    {
        using var connection = GetConnection();
        using var command = new MySqlCommand(sql, connection);
        command.Parameters.AddRange(parameters);
        
        using var reader = command.ExecuteReader();
        var table = new DataTable(); 
        table.Load(reader); // Loads all rows from reader into DataTable
        return table;
    }
    
    //Create a new Parameter
    protected static MySqlParameter GenrParam(string name, object value)
    {
        return new MySqlParameter(name, value ?? DBNull.Value);
    }

}
