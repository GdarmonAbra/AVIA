using System.CommandLine;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class ReadCommand
{
    private sealed record Payload(string Type, string Name, string? Model);

    public static Command Build(IMetadataProvider provider)
    {
        var cmd = new Command("read", "Read a single X++ object.");
        var jsonOpt = CommandHelpers.JsonOption();
        cmd.AddOption(jsonOpt);
        cmd.SetHandler(async (string json) =>
        {
            var p = CommandHelpers.ParseJson<Payload>(json);
            var obj = await provider.ReadAsync(CommandHelpers.ParseType(p.Type), p.Name, p.Model, default);
            if (obj is null)
            {
                CommandHelpers.WriteJson(new { error = new { code = "not_found", message = $"{p.Type} {p.Name} not found" } });
                return;
            }
            CommandHelpers.WriteJson(new { @object = obj });
        }, jsonOpt);
        return cmd;
    }
}
