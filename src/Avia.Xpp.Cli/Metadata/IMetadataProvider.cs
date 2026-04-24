namespace Avia.Xpp.Cli.Metadata;

public enum XppObjectType
{
    Table,
    Form,
    Class,
    Enum,
    View,
    Query,
    MenuItem,
    Edt,
    Map,
}

public sealed record XppObject(
    XppObjectType Type,
    string Name,
    string Model,
    string? Path,
    IReadOnlyDictionary<string, object?> Properties,
    string? Source);

public sealed record CompileDiagnostic(
    string File,
    int Line,
    int Column,
    string Severity,
    string Code,
    string Message);

public sealed record CompileResult(
    bool Ok,
    IReadOnlyList<CompileDiagnostic> Errors,
    IReadOnlyList<CompileDiagnostic> Warnings,
    string Log);

public interface IMetadataProvider
{
    Task<IReadOnlyList<XppObject>> FindAsync(XppObjectType type, string query, string? model, CancellationToken ct);
    Task<XppObject?> ReadAsync(XppObjectType type, string name, string? model, CancellationToken ct);
    Task<XppObject> CreateAsync(XppObjectType type, string name, string model, IReadOnlyDictionary<string, object?> properties, CancellationToken ct);
    Task<XppObject> UpdateAsync(XppObjectType type, string name, string model, IReadOnlyList<JsonPatchOp> patch, CancellationToken ct);
    Task<CompileResult> CompileAsync(string? model, string? project, CancellationToken ct);
    Task<CompileResult> SyncDbAsync(string model, CancellationToken ct);
    Task<DeployResult> DeployAsync(string model, string env, CancellationToken ct);
}

public sealed record JsonPatchOp(string Op, string Path, object? Value);

public sealed record DeployResult(bool Ok, string DeploymentId);
