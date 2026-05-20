#if UNITY_EDITOR
using System.IO;
using System.Text.RegularExpressions;
using NUnit.Framework;

public class PrototypeMomentumAssistValidationTests
{
    [Test]
    public void MomentumAssistDoesNotResetPhysicsOrVelocity()
    {
        string momentumAssistPath = Path.Combine("Assets", "Scripts", "Prototype", "PrototypeMomentumAssist.cs");
        Assert.True(File.Exists(momentumAssistPath), $"Missing file: {momentumAssistPath}");

        string source = File.ReadAllText(momentumAssistPath);

        Assert.False(Regex.IsMatch(source, @"\.linearVelocity\s*="), "MomentumAssist must not assign linearVelocity directly.");
        Assert.False(Regex.IsMatch(source, @"\.angularVelocity\s*="), "MomentumAssist must not assign angularVelocity directly.");
        Assert.False(Regex.IsMatch(source, @"ResetVelocity"), "MomentumAssist must not call ResetVelocity.");
        Assert.False(Regex.IsMatch(source, @"ResetAngularVelocity"), "MomentumAssist must not call ResetAngularVelocity.");
        Assert.False(Regex.IsMatch(source, @"ResetPosition"), "MomentumAssist must not call ResetPosition.");
    }
}
#endif
