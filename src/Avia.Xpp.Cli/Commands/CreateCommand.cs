using System.CommandLine;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class CreateCommand
{
    private sealed record Payload(string Type, string Name, string Model, Dictionary<string, object?> Properties);

    public static Command Build(IMetadataProvider provider)
    {
        var cmd = new Command("create", "Create a new X++ object.");
        var jsonOpt = CommandHelpers.JsonOption();
        cmd.AddOption(jsonOpt);
        cmd.SetHandler(async (string json) =>
        {
            var p = CommandHelpers.ParseJson<Payload>(json);
            var obj = await provider.CreateAsync(
                CommandHelpers.ParseType(p.Type),
                p.Name,
                p.Model,
                p.Properties,
                default);
            CommandHelpers.WriteJson(new { @object = obj });
        }, jsonOpt);
        return cmd;
    }
}
