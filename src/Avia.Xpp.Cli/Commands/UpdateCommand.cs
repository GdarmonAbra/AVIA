using System.CommandLine;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli.Commands;

internal static class UpdateCommand
{
    private sealed record Payload(string Type, string Name, string Model, List<JsonPatchOp> Patch);

    public static Command Build(IMetadataProvider provider)
    {
        var cmd = new Command("update", "Apply a JSON patch to an X++ object.");
        var jsonOpt = CommandHelpers.JsonOption();
        cmd.AddOption(jsonOpt);
        cmd.SetHandler(async (string json) =>
        {
            var p = CommandHelpers.ParseJson<Payload>(json);
            var obj = await provider.UpdateAsync(
                CommandHelpers.ParseType(p.Type),
                p.Name,
                p.Model,
                p.Patch,
                default);
            CommandHelpers.WriteJson(new { @object = obj });
        }, jsonOpt);
        return cmd;
    }
}
