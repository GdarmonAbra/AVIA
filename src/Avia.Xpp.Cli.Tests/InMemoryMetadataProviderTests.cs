using Avia.Xpp.Cli.Metadata;
using Xunit;

namespace Avia.Xpp.Cli.Tests;

public class InMemoryMetadataProviderTests
{
    [Fact]
    public async Task Create_then_Read_round_trips()
    {
        var p = new InMemoryMetadataProvider();
        await p.CreateAsync(
            XppObjectType.Table,
            "CustComplianceCertification",
            "AviaCustomizations",
            new Dictionary<string, object?> { ["label"] = "Compliance Certification" },
            default);

        var read = await p.ReadAsync(XppObjectType.Table, "CustComplianceCertification", "AviaCustomizations", default);

        Assert.NotNull(read);
        Assert.Equal("CustComplianceCertification", read!.Name);
        Assert.Equal("Compliance Certification", read.Properties["label"]);
    }

    [Fact]
    public async Task Update_applies_replace_patch()
    {
        var p = new InMemoryMetadataProvider();
        await p.CreateAsync(XppObjectType.Table, "T", "M", new Dictionary<string, object?> { ["label"] = "a" }, default);

        await p.UpdateAsync(
            XppObjectType.Table,
            "T",
            "M",
            new[] { new JsonPatchOp("replace", "/label", "b") },
            default);

        var read = await p.ReadAsync(XppObjectType.Table, "T", "M", default);
        Assert.Equal("b", read!.Properties["label"]);
    }

    [Fact]
    public async Task Compile_returns_ok_for_empty_model()
    {
        var p = new InMemoryMetadataProvider();
        var result = await p.CompileAsync("AviaCustomizations", null, default);
        Assert.True(result.Ok);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public async Task Find_filters_by_type_and_substring()
    {
        var p = new InMemoryMetadataProvider();
        await p.CreateAsync(XppObjectType.Table, "CustTableX", "M", new Dictionary<string, object?>(), default);
        await p.CreateAsync(XppObjectType.Form, "CustFormX", "M", new Dictionary<string, object?>(), default);

        var matches = await p.FindAsync(XppObjectType.Table, "cust", null, default);

        Assert.Single(matches);
        Assert.Equal("CustTableX", matches[0].Name);
    }
}
