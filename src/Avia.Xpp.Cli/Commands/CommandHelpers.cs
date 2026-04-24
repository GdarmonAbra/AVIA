using System.CommandLine;
using System.Text.Json;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class CommandHelpers
{
    public static Option<string> JsonOption() => new("--json", "JSON payload for this verb.") { IsRequired = true };

    public static T ParseJson<T>(string json) =>
        JsonSerializer.Deserialize<T>(json, Program.JsonOptions)
        ?? throw new InvalidOperationException($"Failed to parse JSON payload for {typeof(T).Name}.");

    public static void WriteJson(object value)
    {
        Console.Out.Write(JsonSerializer.Serialize(value, Program.JsonOptions));
    }

    public static XppObjectType ParseType(string raw) => raw.ToLowerInvariant() switch
    {
        "table" => XppObjectType.Table,
        "form" => XppObjectType.Form,
        "class" => XppObjectType.Class,
        "enum" => XppObjectType.Enum,
        "view" => XppObjectType.View,
        "query" => XppObjectType.Query,
        "menuitem" => XppObjectType.MenuItem,
        "edt" => XppObjectType.Edt,
        "map" => XppObjectType.Map,
        _ => throw new ArgumentException($"Unknown X++ object type: {raw}"),
    };
}
