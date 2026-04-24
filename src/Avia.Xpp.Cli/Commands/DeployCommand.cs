using System.CommandLine;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class DeployCommand
{
    private sealed record Payload(string Model, string Env);

    public static Command Build(IMetadataProvider provider)
    {
        var cmd = new Command("deploy", "Deploy a compiled model to a target environment.");
        var jsonOpt = CommandHelpers.JsonOption();
        cmd.AddOption(jsonOpt);
        cmd.SetHandler(async (string json) =>
        {
            var p = CommandHelpers.ParseJson<Payload>(json);
            var result = await provider.DeployAsync(p.Model, p.Env, default);
            CommandHelpers.WriteJson(result);
        }, jsonOpt);
        return cmd;
    }
}
