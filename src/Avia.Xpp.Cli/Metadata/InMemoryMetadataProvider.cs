using System.Collections.Concurrent;

namespace Avia.Xpp.Cli.Metadata;

/// <summary>
/// Dev/test provider with no dependency on D365 tools. Used by CI and by local
/// unit tests. The real provider (DynamicsMetadataProvider) lands in AVIA-005
/// once the .NET references are available on the build host.
/// </summary>
public sealed class InMemoryMetadataProvider : IMetadataProvider
{
    private readonly ConcurrentDictionary<(XppObjectType, string, string), XppObject> _objects = new();

    public Task<IReadOnlyList<XppObject>> FindAsync(XppObjectType type, string query, string? model, CancellationToken ct)
    {
        var matches = _objects.Values
            .Where(o => o.Type == type)
            .Where(o => model is null || o.Model == model)
            .Where(o => o.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
            .ToList();
        return Task.FromResult<IReadOnlyList<XppObject>>(matches);
    }

    public Task<XppObject?> ReadAsync(XppObjectType type, string name, string? model, CancellationToken ct)
    {
        var key = (type, name, model ?? "");
        _objects.TryGetValue(key, out var obj);
        return Task.FromResult<XppObject?>(obj);
    }

    public Task<XppObject> CreateAsync(XppObjectType type, string name, string model, IReadOnlyDictionary<string, object?> properties, CancellationToken ct)
    {
        var obj = new XppObject(type, name, model, Path: null, Properties: properties, Source: null);
        _objects[(type, name, model)] = obj;
        return Task.FromResult(obj);
    }

    public Task<XppObject> UpdateAsync(XppObjectType type, string name, string model, IReadOnlyList<JsonPatchOp> patch, CancellationToken ct)
    {
        if (!_objects.TryGetValue((type, name, model), out var obj))
        {
            throw new InvalidOperationException($"Object not found: {type} {name} in {model}");
        }
        var props = new Dictionary<string, object?>(obj.Properties);
        foreach (var op in patch)
        {
            var key = op.Path.TrimStart('/');
            switch (op.Op)
            {
                case "add":
                case "replace":
                    props[key] = op.Value;
                    break;
                case "remove":
                    props.Remove(key);
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported patch op: {op.Op}");
            }
        }
        var updated = obj with { Properties = props };
        _objects[(type, name, model)] = updated;
        return Task.FromResult(updated);
    }

    public Task<CompileResult> CompileAsync(string? model, string? project, CancellationToken ct)
    {
        return Task.FromResult(new CompileResult(true, Array.Empty<CompileDiagnostic>(), Array.Empty<CompileDiagnostic>(), $"in-memory compile ok for model={model} project={project}"));
    }

    public Task<CompileResult> SyncDbAsync(string model, CancellationToken ct)
    {
        return Task.FromResult(new CompileResult(true, Array.Empty<CompileDiagnostic>(), Array.Empty<CompileDiagnostic>(), $"in-memory sync ok for {model}"));
    }

    public Task<DeployResult> DeployAsync(string model, string env, CancellationToken ct)
    {
        return Task.FromResult(new DeployResult(true, $"inmem-{model}-{env}-{Guid.NewGuid():N}"));
    }
}

public static class MetadataProviderFactory
{
    public static IMetadataProvider Create()
    {
        var toolsPath = Environment.GetEnvironmentVariable("AVIA_D365_TOOLS_PATH");
        if (!string.IsNullOrWhiteSpace(toolsPath) && Directory.Exists(toolsPath))
        {
            // TODO(avia-005): DynamicsMetadataProvider backed by
            // Microsoft.Dynamics.AX.Metadata.* — requires the dev box install.
        }
        return new InMemoryMetadataProvider();
    }
}
