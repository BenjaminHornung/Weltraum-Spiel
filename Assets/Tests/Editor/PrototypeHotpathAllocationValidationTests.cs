#if UNITY_EDITOR
using System;
using System.IO;
using NUnit.Framework;

public class PrototypeHotpathAllocationValidationTests
{
    [Test]
    public void RcsAllocatorSourceReusesScratchBuffersInHotpathMethods()
    {
        string sourceFile = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Scripts", "Prototype", "RcsThrusterController.cs");
        Assert.True(File.Exists(sourceFile), sourceFile);

        string source = File.ReadAllText(sourceFile);
        string allocatorRegion = ExtractRegion(source, "private void AllocateAndApplyRcs", "private string DetermineAllocatorStatus");

        Assert.That(allocatorRegion, Does.Not.Contain("ToArray("));
        Assert.That(allocatorRegion, Does.Not.Contain("new System.Collections.Generic.List<RcsAllocation>"));
        Assert.That(allocatorRegion, Does.Not.Contain("new List<RcsAllocation>"));
        Assert.That(ExtractRegion(source, "private void ApplyAllocatedForces", "private void ApplySpoolDownForces"), Does.Not.Contain("new float["));
        Assert.That(ExtractRegion(source, "private void ApplySpoolDownForces", "private void EnsureActualThrottleCapacity"), Does.Not.Contain("new float["));
    }

    [Test]
    public void VisualSwitcherSourceOnlyStripsDedicatedManagerObjectInAwakeAndApplyNow()
    {
        string sourceFile = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Scripts", "Prototype", "PrototypeShipVisualSwitcher.cs");
        Assert.True(File.Exists(sourceFile), sourceFile);

        string source = File.ReadAllText(sourceFile);

        Assert.That(ExtractRegion(source, "private void Awake()", "private void Update()"), Does.Not.Contain("StripManagerObjectComponents(gameObject)"));
        Assert.That(ExtractRegion(source, "public void ApplyNow()", "private void ResetForRuntimeBaseline()"), Does.Not.Contain("StripManagerObjectComponents(gameObject)"));
        Assert.That(source, Does.Contain("IsRuntimeManagerObject(gameObject)"));
    }

    private static string ExtractRegion(string source, string startToken, string endToken)
    {
        int start = source.IndexOf(startToken, StringComparison.Ordinal);
        Assert.That(start, Is.GreaterThanOrEqualTo(0), startToken);
        int end = source.IndexOf(endToken, start + startToken.Length, StringComparison.Ordinal);
        Assert.That(end, Is.GreaterThan(start), endToken);
        return source.Substring(start, end - start);
    }
}
#endif
