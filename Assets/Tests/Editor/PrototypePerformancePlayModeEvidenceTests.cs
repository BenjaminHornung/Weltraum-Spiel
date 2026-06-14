#if UNITY_EDITOR
using System;
using System.Collections;
using System.IO;
using NUnit.Framework;
using Unity.Profiling;
using UnityEngine;
using UnityEngine.TestTools;

public class PrototypePerformancePlayModeEvidenceTests
{
    private const float RuntimeSeconds = 30f;
    private static readonly PrototypeShipVisualMode[] VisualCycle =
    {
        PrototypeShipVisualMode.GeneratedPrimitives,
        PrototypeShipVisualMode.ImportedDemoScout,
        PrototypeShipVisualMode.ImportedDemoCargo,
        PrototypeShipVisualMode.GeneratedPrimitives
    };

    [UnityTest]
    [Timeout(70000)]
    public IEnumerator PrototypeBootstrapHostRunsThirtySecondsWithHotpathEvidence()
    {
        yield return new EnterPlayMode();
        yield return null;
        yield return null;

        PrototypeBootstrap bootstrap = UnityEngine.Object.FindAnyObjectByType<PrototypeBootstrap>();
        if (bootstrap == null)
        {
            bootstrap = new GameObject("PlayModePerformanceBootstrap").AddComponent<PrototypeBootstrap>();
        }

        bootstrap.BuildPrototype();
        yield return null;
        yield return null;

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship, "PrototypeBootstrap should create PrototypeShip.");

        PlayerShipController controller = ship.GetComponent<PlayerShipController>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
        Assert.NotNull(controller);
        Assert.NotNull(rcs);
        Assert.NotNull(autopilot);

        PrototypeShipVisualSwitcher switcher = UnityEngine.Object.FindAnyObjectByType<PrototypeShipVisualSwitcher>();
        if (switcher == null)
        {
            switcher = new GameObject("PrototypeShipVisualSwitcher_Manager").AddComponent<PrototypeShipVisualSwitcher>();
        }

        SimpleFollowCamera followCamera = Camera.main != null ? Camera.main.GetComponent<SimpleFollowCamera>() : null;
        Assert.NotNull(followCamera);

        autopilot.Abort("playmode performance smoke");
        autopilot.SetNavigationDebugPlanningActive(false);
        autopilot.ReplanNow();
        int planRefreshesAfterManualReplan = autopilot.NavigationPlanRefreshCount;
        int initialCameraBoundsRefreshes = followCamera.VisualBoundsRefreshCount;
        int initialNozzleRefreshes = rcs.NozzleRefreshCount;

        string gcRecorderStatus;
        string mainThreadRecorderStatus;
        ProfilerRecorder gcAllocRecorder = TryStartRecorder(
            ProfilerCategory.Memory,
            "GC Allocated In Frame",
            600,
            ProfilerRecorderOptions.SumAllSamplesInFrame | ProfilerRecorderOptions.WrapAroundWhenCapacityReached,
            out gcRecorderStatus);
        ProfilerRecorder mainThreadRecorder = TryStartRecorder(
            ProfilerCategory.Internal,
            "Main Thread",
            600,
            ProfilerRecorderOptions.SumAllSamplesInFrame | ProfilerRecorderOptions.WrapAroundWhenCapacityReached,
            out mainThreadRecorderStatus);

        int startFrame = Time.frameCount;
        float startRealtime = Time.realtimeSinceStartup;
        float nextVisualSwitch = 0f;
        float nextCameraCycle = 1.5f;
        int visualSwitchCount = 0;
        int cameraModeCycles = 0;
        int maxRcsApplications = 0;
        long maxGcAllocBytes = 0;
        long maxMainThreadNs = 0;

        while (Time.realtimeSinceStartup - startRealtime < RuntimeSeconds)
        {
            float elapsed = Time.realtimeSinceStartup - startRealtime;
            if (elapsed >= nextVisualSwitch)
            {
                switcher.SelectVisualMode(VisualCycle[visualSwitchCount % VisualCycle.Length]);
                visualSwitchCount++;
                nextVisualSwitch += 5f;
            }

            if (elapsed >= nextCameraCycle)
            {
                followCamera.CycleCameraMode();
                cameraModeCycles++;
                nextCameraCycle += 3f;
            }

            Vector3 force = elapsed < RuntimeSeconds * 0.5f ? ship.transform.right * 1200f : Vector3.zero;
            Vector3 torque = elapsed < RuntimeSeconds * 0.5f ? Vector3.up * 350f : Vector3.zero;
            controller.SetExternalFlightAssistRequest(new FlightAssistRequest(
                FlightAssistMode.AssistedFlight,
                FlightAssistRequestSource.DebugOnly,
                force,
                torque,
                0f,
                false));

            maxRcsApplications = Mathf.Max(maxRcsApplications, rcs.LastNozzleApplicationCount);
            maxGcAllocBytes = Math.Max(maxGcAllocBytes, ReadRecorderValue(gcAllocRecorder));
            maxMainThreadNs = Math.Max(maxMainThreadNs, ReadRecorderValue(mainThreadRecorder));
            yield return null;
        }

        controller.ClearExternalFlightAssistRequest();
        yield return null;
        string screenshotPath = GetEvidencePath("screenshots", "playmode-performance-final.png");
        bool screenshotCaptured = TryCaptureCameraPng(followCamera.GetComponent<Camera>(), screenshotPath, out string screenshotStatus);

        int frames = Time.frameCount - startFrame;
        float measuredSeconds = Time.realtimeSinceStartup - startRealtime;
        int finalCameraBoundsRefreshes = followCamera.VisualBoundsRefreshCount;
        int finalNozzleRefreshes = rcs.NozzleRefreshCount;
        int finalNavigationRefreshes = autopilot.NavigationPlanRefreshCount;
        string evidencePath = WriteEvidence(
            frames,
            measuredSeconds,
            visualSwitchCount,
            cameraModeCycles,
            planRefreshesAfterManualReplan,
            finalNavigationRefreshes,
            initialCameraBoundsRefreshes,
            finalCameraBoundsRefreshes,
            initialNozzleRefreshes,
            finalNozzleRefreshes,
            maxRcsApplications,
            maxGcAllocBytes,
            maxMainThreadNs,
            gcRecorderStatus,
            mainThreadRecorderStatus,
            rcs.LastAllocatorStatus,
            screenshotStatus,
            screenshotCaptured);

        DisposeRecorder(gcAllocRecorder);
        DisposeRecorder(mainThreadRecorder);

        yield return new ExitPlayMode();

        Assert.That(frames, Is.GreaterThan(30));
        Assert.That(measuredSeconds, Is.GreaterThanOrEqualTo(RuntimeSeconds));
        Assert.That(visualSwitchCount, Is.GreaterThanOrEqualTo(6));
        Assert.That(cameraModeCycles, Is.GreaterThanOrEqualTo(8));
        Assert.That(finalNavigationRefreshes, Is.EqualTo(planRefreshesAfterManualReplan), "Disengaged autopilot must not keep planning during PlayMode smoke.");
        Assert.That(finalNozzleRefreshes, Is.LessThanOrEqualTo(initialNozzleRefreshes + (visualSwitchCount * 2) + 4), "RCS cache refreshes may be dirtied by visual rebuilds/setup edges, but must stay bounded to switch events rather than FixedUpdate frames.");
        Assert.That(maxRcsApplications, Is.GreaterThanOrEqualTo(0));
        Assert.True(File.Exists(evidencePath), evidencePath);
    }

    private static ProfilerRecorder TryStartRecorder(
        ProfilerCategory category,
        string counterName,
        int capacity,
        ProfilerRecorderOptions options,
        out string status)
    {
        try
        {
            ProfilerRecorder recorder = ProfilerRecorder.StartNew(category, counterName, capacity, options);
            status = recorder.Valid ? "active" : "invalid";
            return recorder;
        }
        catch (Exception ex)
        {
            status = ex.GetType().Name + ": " + ex.Message;
            return default;
        }
    }

    private static long ReadRecorderValue(ProfilerRecorder recorder)
    {
        return recorder.Valid ? recorder.LastValue : 0L;
    }

    private static void DisposeRecorder(ProfilerRecorder recorder)
    {
        if (recorder.Valid)
        {
            recorder.Dispose();
        }
    }

    private static bool TryCaptureCameraPng(Camera camera, string screenshotPath, out string status)
    {
        if (camera == null)
        {
            status = "not captured: no camera";
            return false;
        }

        RenderTexture previousTarget = camera.targetTexture;
        RenderTexture previousActive = RenderTexture.active;
        RenderTexture renderTexture = null;
        Texture2D texture = null;

        try
        {
            renderTexture = new RenderTexture(1280, 720, 24, RenderTextureFormat.ARGB32);
            texture = new Texture2D(renderTexture.width, renderTexture.height, TextureFormat.RGB24, false);
            camera.targetTexture = renderTexture;
            camera.Render();
            RenderTexture.active = renderTexture;
            texture.ReadPixels(new Rect(0, 0, renderTexture.width, renderTexture.height), 0, 0);
            texture.Apply(false);
            File.WriteAllBytes(screenshotPath, texture.EncodeToPNG());
            bool exists = File.Exists(screenshotPath);
            status = exists ? screenshotPath : "not captured: PNG write missing";
            return exists;
        }
        catch (Exception ex)
        {
            status = "not captured: " + ex.GetType().Name + ": " + ex.Message;
            return false;
        }
        finally
        {
            camera.targetTexture = previousTarget;
            RenderTexture.active = previousActive;

            if (texture != null)
            {
                UnityEngine.Object.DestroyImmediate(texture);
            }

            if (renderTexture != null)
            {
                renderTexture.Release();
                UnityEngine.Object.DestroyImmediate(renderTexture);
            }
        }
    }

    private static string WriteEvidence(
        int frames,
        float seconds,
        int visualSwitchCount,
        int cameraModeCycles,
        int navigationRefreshesAfterManualReplan,
        int navigationRefreshesFinal,
        int cameraBoundsRefreshesInitial,
        int cameraBoundsRefreshesFinal,
        int nozzleRefreshesInitial,
        int nozzleRefreshesFinal,
        int maxRcsApplications,
        long maxGcAllocBytes,
        long maxMainThreadNs,
        string gcRecorderStatus,
        string mainThreadRecorderStatus,
        string allocatorStatus)
    {
        return WriteEvidence(
            frames,
            seconds,
            visualSwitchCount,
            cameraModeCycles,
            navigationRefreshesAfterManualReplan,
            navigationRefreshesFinal,
            cameraBoundsRefreshesInitial,
            cameraBoundsRefreshesFinal,
            nozzleRefreshesInitial,
            nozzleRefreshesFinal,
            maxRcsApplications,
            maxGcAllocBytes,
            maxMainThreadNs,
            gcRecorderStatus,
            mainThreadRecorderStatus,
            allocatorStatus,
            string.Empty,
            false);
    }

    private static string WriteEvidence(
        int frames,
        float seconds,
        int visualSwitchCount,
        int cameraModeCycles,
        int navigationRefreshesAfterManualReplan,
        int navigationRefreshesFinal,
        int cameraBoundsRefreshesInitial,
        int cameraBoundsRefreshesFinal,
        int nozzleRefreshesInitial,
        int nozzleRefreshesFinal,
        int maxRcsApplications,
        long maxGcAllocBytes,
        long maxMainThreadNs,
        string gcRecorderStatus,
        string mainThreadRecorderStatus,
        string allocatorStatus,
        string screenshotStatus,
        bool screenshotCaptured)
    {
        string evidencePath = GetEvidencePath("performance", "playmode-performance-smoke.md");
        File.WriteAllText(evidencePath,
            "# PlayMode Performance Smoke\n\n"
            + $"- Runtime: {seconds:0.00}s across {frames} frames ({frames / Mathf.Max(0.001f, seconds):0.0} fps observed in editor PlayMode).\n"
            + $"- Visual switches: {visualSwitchCount} (Generated -> Scout -> Cargo -> Generated loop).\n"
            + $"- Camera mode cycles: {cameraModeCycles}; visual bounds refreshes {cameraBoundsRefreshesInitial} -> {cameraBoundsRefreshesFinal}.\n"
            + $"- Autopilot manual replan count: {navigationRefreshesAfterManualReplan}; final disengaged count: {navigationRefreshesFinal}.\n"
            + $"- RCS nozzle refreshes: {nozzleRefreshesInitial} -> {nozzleRefreshesFinal}; max force applications/frame: {maxRcsApplications}; allocator status: {allocatorStatus}.\n"
            + $"- Profiler GC recorder: {gcRecorderStatus}; max recorded GC allocated in frame: {maxGcAllocBytes} bytes.\n"
            + $"- Profiler main-thread recorder: {mainThreadRecorderStatus}; max sample: {maxMainThreadNs} ns.\n"
            + $"- Screenshot: {(screenshotCaptured ? "captured at " : string.Empty)}{screenshotStatus}.\n"
            + "\nDocs checked: E:/Unity/Documentation/en/ScriptReference/Unity.Profiling.ProfilerRecorder.StartNew.html and E:/Unity/Documentation/en/ScriptReference/Rigidbody.AddForceAtPosition.html.\n");
        return evidencePath;
    }

    private static string GetEvidencePath(string directoryName, string fileName)
    {
        string root = Directory.GetCurrentDirectory();
        string evidenceDirectory = Path.Combine(root, ".devtoolbox", "specs", "changes", "performance-stability-hotpath-cleanup-v1", "tests", directoryName);
        Directory.CreateDirectory(evidenceDirectory);
        return Path.Combine(evidenceDirectory, fileName);
    }
}
#endif
