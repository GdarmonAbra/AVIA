using System.CommandLine;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class FindCommand
{
    private sealed record Payload(string Type, string Query, string? Model);

    public static Command Build(IMetadataProvider provider)
    {
        var cmd = new Command("find", "Find X++ objects by query.");
        var jsonOpt = CommandHelpers.JsonOption();
        cmd.AddOption(jsonOpt);
        cmd.SetHandler(async (string json) =>
        {
            var p = CommandHelpers.ParseJson<Payload>(json);
            var matches = await provider.FindAsync(CommandHelpers.ParseType(p.Type), p.Query, p.Model, default);
            CommandHelpers.WriteJson(new { matches });
        }, jsonOpt);
        return cmd;
    }
}
