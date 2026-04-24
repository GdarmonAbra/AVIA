using System.CommandLine;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class CompileCommand
{
    private sealed record Payload(string? Model, string? Project);

    public static Command Build(IMetadataProvider provider)
    {
        var cmd = new Command("compile", "Compile a model or project.");
        var jsonOpt = CommandHelpers.JsonOption();
        cmd.AddOption(jsonOpt);
        cmd.SetHandler(async (string json) =>
        {
            var p = CommandHelpers.ParseJson<Payload>(json);
            var result = await provider.CompileAsync(p.Model, p.Project, default);
            CommandHelpers.WriteJson(result);
        }, jsonOpt);
        return cmd;
    }
}
