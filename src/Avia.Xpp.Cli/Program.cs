using System.CommandLine;
using System.Text.Json;
using Avia.Xpp.Cli.Commands;
using Avia.Xpp.Cli.Metadata;

namespace Avia.Xpp.Cli;

public static class Program
{
    internal static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public static async Task<int> Main(string[] args)
    {
        var provider = MetadataProviderFactory.Create();
        var root = new RootCommand("avia-xpp: Dynamics 365 F&O X++ metadata bridge")
        {
            FindCommand.Build(provider),
            ReadCommand.Build(provider),
            CreateCommand.Build(provider),
            UpdateCommand.Build(provider),
            CompileCommand.Build(provider),
            SyncDbCommand.Build(provider),
            DeployCommand.Build(provider),
        };
        return await root.InvokeAsync(args);
    }
}
