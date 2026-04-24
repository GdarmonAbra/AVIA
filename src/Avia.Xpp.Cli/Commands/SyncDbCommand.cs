using System.CommandLine;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class SyncDbCommand
{
    private sealed record Payload(string Model);

    public static Command Build(IMetadataProvider provider)
    {
        var cmd = new Command("sync-db", "Run the database sync for a model.");
        var jsonOpt = CommandHelpers.JsonOption();
        cmd.AddOption(jsonOpt);
        cmd.SetHandler(async (string json) =>
        {
            var p = CommandHelpers.ParseJson<Payload>(json);
            var result = await provider.SyncDbAsync(p.Model, default);
            CommandHelpers.WriteJson(result);
        }, jsonOpt);
        return cmd;
    }
}
