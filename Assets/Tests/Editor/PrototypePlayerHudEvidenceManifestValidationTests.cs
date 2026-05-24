using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using UnityEngine;

public class PrototypePlayerHudEvidenceManifestValidationTests
{
    private const string ManifestPath = ".devtoolbox/specs/changes/player-ui-evidence-manifest-v1/tests/player-ui-evidence-manifest.json";
    private const string DevToolboxChangesPath = ".devtoolbox/specs/changes";
    private const int MinimumManifestCount = 27;

    [Test]
    public void PlayerUiEvidenceManifestScreenshotsExistAndMatchPngHeaders()
    {
        string projectRoot = ResolveProjectRoot();
        string manifestPath = Path.Combine(projectRoot, ManifestPath);
        Assert.That(File.Exists(manifestPath), Is.True, manifestPath);

        PlayerUiEvidenceManifest manifest = JsonUtility.FromJson<PlayerUiEvidenceManifest>(File.ReadAllText(manifestPath));
        Assert.NotNull(manifest, "manifest");
        Assert.That(manifest.manifestVersion, Is.EqualTo(1));
        Assert.That(manifest.sourceDocument, Is.EqualTo("docs/player-facing-ui-concept-v0.md"));
        Assert.NotNull(manifest.screenshots, "manifest screenshots");
        Assert.That(manifest.screenshots.Length, Is.GreaterThanOrEqualTo(MinimumManifestCount));

        string allowedRoot = EnsureTrailingSeparator(Path.GetFullPath(Path.Combine(projectRoot, DevToolboxChangesPath)));
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        bool hasLivePlayMode = false;
        bool hasRenderedExporter = false;
        bool hasAspectCoverage = false;

        for (int i = 0; i < manifest.screenshots.Length; i++)
        {
            PlayerUiEvidenceScreenshot screenshot = manifest.screenshots[i];
            AssertValidEntry(projectRoot, allowedRoot, screenshot, ids, paths);
            hasLivePlayMode |= screenshot.captureKind == "live-playmode";
            hasRenderedExporter |= screenshot.captureKind == "unity-rendered-exporter";
            hasAspectCoverage |= screenshot.captureKind == "live-aspect";
        }

        Assert.That(hasLivePlayMode, Is.True, "manifest includes real PlayMode captures");
        Assert.That(hasRenderedExporter, Is.True, "manifest includes renderer-state captures");
        Assert.That(hasAspectCoverage, Is.True, "manifest includes aspect-ratio captures");
    }

    private static void AssertValidEntry(
        string projectRoot,
        string allowedRoot,
        PlayerUiEvidenceScreenshot screenshot,
        HashSet<string> ids,
        HashSet<string> paths)
    {
        Assert.False(string.IsNullOrWhiteSpace(screenshot.id), "manifest id");
        Assert.False(string.IsNullOrWhiteSpace(screenshot.path), screenshot.id + " path");
        Assert.False(Path.IsPathRooted(screenshot.path), screenshot.id + " path must be repository-relative");
        Assert.That(ids.Add(screenshot.id), Is.True, "duplicate manifest id: " + screenshot.id);
        Assert.That(paths.Add(screenshot.path), Is.True, "duplicate manifest path: " + screenshot.path);

        string fullPath = Path.GetFullPath(Path.Combine(projectRoot, screenshot.path));
        Assert.That(fullPath.StartsWith(allowedRoot, StringComparison.OrdinalIgnoreCase), Is.True, screenshot.id + " must stay inside .devtoolbox/specs/changes");
        Assert.That(File.Exists(fullPath), Is.True, fullPath);

        FileInfo fileInfo = new FileInfo(fullPath);
        Assert.That(fileInfo.Length, Is.GreaterThanOrEqualTo(Mathf.Max(4096, screenshot.minBytes)), screenshot.id + " file size");
        Assert.That(screenshot.width, Is.GreaterThan(0), screenshot.id + " width");
        Assert.That(screenshot.height, Is.GreaterThan(0), screenshot.id + " height");

        byte[] header = new byte[24];
        using (FileStream stream = File.OpenRead(fullPath))
        {
            int read = stream.Read(header, 0, header.Length);
            Assert.That(read, Is.EqualTo(header.Length), screenshot.id + " PNG header length");
        }

        AssertPngSignature(header, screenshot.id);
        int width = ReadBigEndianInt32(header, 16);
        int height = ReadBigEndianInt32(header, 20);
        Assert.That(width, Is.EqualTo(screenshot.width), screenshot.id + " PNG width");
        Assert.That(height, Is.EqualTo(screenshot.height), screenshot.id + " PNG height");
    }

    private static void AssertPngSignature(byte[] header, string id)
    {
        Assert.That(header[0], Is.EqualTo(0x89), id + " PNG signature byte 0");
        Assert.That(header[1], Is.EqualTo(0x50), id + " PNG signature byte 1");
        Assert.That(header[2], Is.EqualTo(0x4e), id + " PNG signature byte 2");
        Assert.That(header[3], Is.EqualTo(0x47), id + " PNG signature byte 3");
        Assert.That(header[4], Is.EqualTo(0x0d), id + " PNG signature byte 4");
        Assert.That(header[5], Is.EqualTo(0x0a), id + " PNG signature byte 5");
        Assert.That(header[6], Is.EqualTo(0x1a), id + " PNG signature byte 6");
        Assert.That(header[7], Is.EqualTo(0x0a), id + " PNG signature byte 7");
    }

    private static int ReadBigEndianInt32(byte[] bytes, int offset)
    {
        return (bytes[offset] << 24)
            | (bytes[offset + 1] << 16)
            | (bytes[offset + 2] << 8)
            | bytes[offset + 3];
    }

    private static string ResolveProjectRoot()
    {
        string projectRoot = Directory.GetCurrentDirectory();
        if (!Directory.Exists(Path.Combine(projectRoot, "Assets")))
        {
            projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        }

        return projectRoot;
    }

    private static string EnsureTrailingSeparator(string path)
    {
        if (path.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal)
            || path.EndsWith(Path.AltDirectorySeparatorChar.ToString(), StringComparison.Ordinal))
        {
            return path;
        }

        return path + Path.DirectorySeparatorChar;
    }

    [Serializable]
    private sealed class PlayerUiEvidenceManifest
    {
        public int manifestVersion = 0;
        public string sourceDocument = string.Empty;
        public PlayerUiEvidenceScreenshot[] screenshots = Array.Empty<PlayerUiEvidenceScreenshot>();
    }

    [Serializable]
    private sealed class PlayerUiEvidenceScreenshot
    {
        public string id = string.Empty;
        public string path = string.Empty;
        public int width = 0;
        public int height = 0;
        public int minBytes = 0;
        public string captureKind = string.Empty;
        public string state = string.Empty;
    }
}
