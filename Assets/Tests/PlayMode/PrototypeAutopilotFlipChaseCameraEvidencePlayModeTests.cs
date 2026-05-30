using System;
using System.Globalization;
using System.IO;
using System.Reflection;
using NUnit.Framework;
#if UNITY_EDITOR
using UnityEditor.SceneManagement;
#endif
using UnityEngine;
using UnityEngine.SceneManagement;
using Object = UnityEngine.Object;

public class PrototypeAutopilotFlipChaseCameraEvidencePlayModeTests
{
    private const string ScenePath = "Assets/Scenes/PrototypeBootstrapHost.unity";
    private const string ChangeName = "fix-autopilot-flip-chase-camera-v1";
    private const BindingFlags NonPublicInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    private const int WarmupFrames = 24;
    private const int FlipFrames = 54;
    private const int RecoveryFrames = 50;

    private const float SafeViewportMin = 0.15f;
    private const float SafeViewportMax = 0.85f;
    private const float RecoverWindowFrames = 20;
    private const float RecoverErrorThreshold = 0.9f;
    private const float MaxAnchorErrorThreshold = 2.5f;
    private const float MaxCameraErrorThreshold = 2.5f;
    private const float FlipAngularVelocity = 4.25f;

    [Test]
    [Timeout(120000)]
    public void PrototypeBootstrapHostAutopilotFlipChaseCameraEvidence()
    {
        Assert.That(Application.isPlaying, Is.True, "This evidence test must run in Unity PlayMode.");
#if UNITY_EDITOR
        if (SceneManager.GetActiveScene().path != ScenePath)
        {
            EditorSceneManager.LoadSceneInPlayMode(ScenePath, new LoadSceneParameters(LoadSceneMode.Single));
        }
#endif

        Exception failure = null;
        FlipChaseEvidenceRunner runner = null;
        try
        {
            runner = new FlipChaseEvidenceRunner();
            runner.RunAll();
        }
        catch (Exception ex)
        {
            failure = ex;
        }
        finally
        {
            runner?.Dispose();
        }

        if (failure != null)
        {
            throw failure;
        }
    }

    [Test]
    [Timeout(120000)]
    public void PrototypeBootstrapHostGeneratedFallbackAutopilotFlipChaseCameraStaysSafe()
    {
        Assert.That(Application.isPlaying, Is.True, "This evidence test must run in Unity PlayMode.");
#if UNITY_EDITOR
        if (SceneManager.GetActiveScene().path != ScenePath)
        {
            EditorSceneManager.LoadSceneInPlayMode(ScenePath, new LoadSceneParameters(LoadSceneMode.Single));
        }
#endif

        using (FlipChaseEvidenceRunner runner = new FlipChaseEvidenceRunner(
            PrototypeShipVisualMode.GeneratedPrimitives,
            "GeneratedPrimitiveFallback / GeneratedPrimitives"))
        {
            runner.RunSafetyOnly();
        }
    }

    private sealed class FlipChaseEvidenceRunner : IDisposable
    {
        private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

        private readonly GameObject ship;
        private readonly PlayerShipController controller;
        private readonly Rigidbody body;
        private readonly SimpleFollowCamera followCamera;
        private readonly Camera mainCamera;
        private readonly float fixedDeltaTime;
        private readonly string evidenceRoot;
        private readonly string screenshotRoot;
        private readonly StringWriter csv = new StringWriter(Invariant);
        private readonly StringWriter protocol = new StringWriter(Invariant);

        private readonly MethodInfo fixedUpdate;
        private readonly MethodInfo cameraLateUpdate;
        private readonly MethodInfo resolveBaseDistance;
        private readonly MethodInfo getViewDirectionFromPivot;
        private readonly MethodInfo getLookTargetFromMode;
        private readonly MethodInfo resolveEffectiveDistance;
        private readonly Type cameraModeEnumType;
        private readonly FieldInfo autopilotFlipReferenceModeField;
        private readonly FieldInfo targetStatsField;

        private readonly SimulationMode previousSimulationMode;
        private readonly float previousFixedDeltaTime;

        private float simulatedTime;
        private int sampleIndex;
        private int safeViewportSamples;
        private int unsafeViewportSamples;
        private int flipAssistFrames;
        private int assistsDuringFlip;
        private bool flipAssistObserved;
        private int flipAssistStartFrame = -1;
        private int flipAssistEndFrame = -1;
        private int recoveryStartFrame = -1;
        private int recoveryCompleteFrame = -1;
        private float maxCameraError;
        private float maxAnchorError;
        private float maxAngularVelocity;
        private int maxAngularVelocityFrame;

        private readonly PrototypeShipVisualMode visualMode;
        private readonly string scenarioName;

        public FlipChaseEvidenceRunner()
            : this(PrototypeShipVisualMode.ImportedDemoScout, "ImportedDemoScoutFunctionalDefault / ImportedDemoScout fallback pattern")
        {
        }

        public FlipChaseEvidenceRunner(PrototypeShipVisualMode visualMode, string scenarioName)
        {
            this.visualMode = visualMode;
            this.scenarioName = scenarioName;
            previousSimulationMode = Physics.simulationMode;
            previousFixedDeltaTime = Time.fixedDeltaTime;
            Physics.simulationMode = SimulationMode.Script;
            Time.fixedDeltaTime = 0.02f;
            fixedDeltaTime = Time.fixedDeltaTime;

            ship = CreateOrFindShip(visualMode);
            controller = ship.GetComponent<PlayerShipController>();
            body = ship.GetComponent<Rigidbody>();
            Assert.NotNull(controller, "PlayerShipController on PrototypeShip");
            Assert.NotNull(body, "Rigidbody on PrototypeShip");

            mainCamera = Camera.main;
            Assert.NotNull(mainCamera, "Scene must include a main camera.");
            followCamera = mainCamera.GetComponent<SimpleFollowCamera>();
            Assert.NotNull(followCamera, "Main camera must use SimpleFollowCamera.");

            fixedUpdate = typeof(PlayerShipController).GetMethod("FixedUpdate", NonPublicInstance);
            cameraLateUpdate = typeof(SimpleFollowCamera).GetMethod("LateUpdate", NonPublicInstance);
            resolveBaseDistance = typeof(SimpleFollowCamera).GetMethod("ResolveBaseDistance", NonPublicInstance);
            getViewDirectionFromPivot = typeof(SimpleFollowCamera).GetMethod("GetViewDirectionFromPivot", NonPublicInstance);
            getLookTargetFromMode = typeof(SimpleFollowCamera).GetMethod("GetLookTargetFromMode", NonPublicInstance);
            resolveEffectiveDistance = typeof(SimpleFollowCamera).GetMethod("ResolveEffectiveDistance", NonPublicInstance);
            cameraModeEnumType = typeof(SimpleFollowCamera).GetNestedType("CameraViewMode", BindingFlags.NonPublic);
            autopilotFlipReferenceModeField = typeof(SimpleFollowCamera).GetField("autopilotFlipChaseReferenceMode", NonPublicInstance);
            targetStatsField = typeof(SimpleFollowCamera).GetField("targetStats", NonPublicInstance);

            Assert.NotNull(fixedUpdate, "PlayerShipController.FixedUpdate reflection hook must exist.");
            Assert.NotNull(cameraLateUpdate, "SimpleFollowCamera.LateUpdate reflection hook must exist.");
            Assert.NotNull(resolveBaseDistance, "SimpleFollowCamera.ResolveBaseDistance reflection hook must exist.");
            Assert.NotNull(getViewDirectionFromPivot, "SimpleFollowCamera.GetViewDirectionFromPivot reflection hook must exist.");
            Assert.NotNull(getLookTargetFromMode, "SimpleFollowCamera.GetLookTargetFromMode reflection hook must exist.");
            Assert.NotNull(resolveEffectiveDistance, "SimpleFollowCamera.ResolveEffectiveDistance reflection hook must exist.");
            Assert.NotNull(cameraModeEnumType, "SimpleFollowCamera.CameraViewMode nested type must exist.");
            Assert.NotNull(autopilotFlipReferenceModeField, "SimpleFollowCamera.autopilotFlipChaseReferenceMode private field must exist.");
            Assert.NotNull(targetStatsField, "SimpleFollowCamera.targetStats private field must exist.");

            string root = Directory.GetCurrentDirectory();
            evidenceRoot = Path.Combine(root, ".devtoolbox", "specs", "changes", ChangeName, "tests");
            screenshotRoot = Path.Combine(evidenceRoot, "screenshots");
            Directory.CreateDirectory(evidenceRoot);
            Directory.CreateDirectory(Path.Combine(evidenceRoot, "performance"));
            Directory.CreateDirectory(screenshotRoot);
        }

        public static GameObject CreateOrFindShip(PrototypeShipVisualMode visualMode = PrototypeShipVisualMode.ImportedDemoScout)
        {
            PrototypeBootstrap bootstrap = Object.FindAnyObjectByType<PrototypeBootstrap>();
            if (bootstrap == null)
            {
                bootstrap = new GameObject("PrototypeBootstrap").AddComponent<PrototypeBootstrap>();
            }

            if (GameObject.Find("PrototypeShip") == null)
            {
                PrototypeShipBuildMode buildMode = visualMode == PrototypeShipVisualMode.GeneratedPrimitives
                    ? PrototypeShipBuildMode.GeneratedPrimitiveFallback
                    : PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault;
                bootstrap.SetBuildMode(buildMode, false);
                bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());
            }

            PrototypeShipVisualSwitcher switcher = Object.FindAnyObjectByType<PrototypeShipVisualSwitcher>();
            if (switcher == null)
            {
                switcher = new GameObject("PrototypeShipVisualSwitcher_Manager").AddComponent<PrototypeShipVisualSwitcher>();
            }

            switcher.SelectVisualMode(visualMode);
            GameObject ship = GameObject.Find("PrototypeShip");
            Assert.NotNull(ship, "PrototypeShip must exist in the bootstrap host scene.");
            return ship;
        }

        public void RunAll()
        {
            WriteHeaders();
            protocol.WriteLine("# Autopilot Flip Chase Camera Evidence");
            protocol.WriteLine();
            protocol.WriteLine("- Scene: " + SceneManager.GetActiveScene().path);
            protocol.WriteLine("- Unity: " + Application.unityVersion);
            protocol.WriteLine("- Scenario: " + scenarioName + ".");
            protocol.WriteLine("- Goal: verify ChaseLocked assist safety and recovery under FlipForBrake-like angular velocity.");
            protocol.WriteLine();

            ResetForScenario();
            for (int i = 0; i < WarmupFrames; i++)
            {
                StepFrame(Vector3.zero, "before");
            }

            CaptureScreenshot("before-flip-chase.png");

            for (int i = 0; i < FlipFrames; i++)
            {
                StepFrame(new Vector3(0f, FlipAngularVelocity, 0f), "flip");
            }

            CaptureScreenshot("during-flip-chase.png");
            Assert.That(assistsDuringFlip, Is.GreaterThan(0), "Flip assist should become true during high-angular-velocity phase.");
            Assert.That(flipAssistObserved, Is.True, "At least one sample should observe assist enabled.");
            Assert.That(flipAssistStartFrame, Is.GreaterThanOrEqualTo(1), "Assist should engage during flip phase.");

            for (int i = 0; i < RecoveryFrames; i++)
            {
                StepFrame(Vector3.zero, "after");
            }

            CaptureScreenshot("after-flip-chase.png");

            protocol.WriteLine("## Summary");
            protocol.WriteLine("- Total samples: " + sampleIndex);
            protocol.WriteLine("- Total safe samples (ship or anchor viewport safe): " + safeViewportSamples);
            protocol.WriteLine("- Total unsafe samples (ship and anchor unsafe): " + unsafeViewportSamples);
            protocol.WriteLine("- Assist active samples: " + flipAssistFrames);
            protocol.WriteLine("- Assist active frames during flip: " + assistsDuringFlip);
            protocol.WriteLine("- Assist starts at sample: " + flipAssistStartFrame);
            protocol.WriteLine("- Assist ends at sample: " + flipAssistEndFrame);
            protocol.WriteLine("- Recovery start sample: " + (recoveryStartFrame >= 0 ? recoveryStartFrame.ToString() : "not observed"));
            protocol.WriteLine("- Recovery complete sample: " + (recoveryCompleteFrame >= 0 ? recoveryCompleteFrame.ToString() : "not observed"));
            protocol.WriteLine("- Max angular velocity magnitude: " + F(maxAngularVelocity) + " rad/s at sample " + maxAngularVelocityFrame);
            protocol.WriteLine("- Max camera position error: " + F(maxCameraError));
            protocol.WriteLine("- Max anchor error: " + F(maxAnchorError));
            if (recoveryCompleteFrame >= 0 && recoveryStartFrame >= 0)
            {
                protocol.WriteLine("- Recovery window (frames): " + (recoveryCompleteFrame - recoveryStartFrame));
            }
            protocol.WriteLine();

            try
            {
                Assert.That(followCamera.CameraModeName, Is.EqualTo("ChaseLocked"), "Camera should be in ChaseLocked for the assist scenario.");
                Assert.That(unsafeViewportSamples, Is.EqualTo(0), "Viewport target/anchor should stay in safe zone in all sampled frames.");
                Assert.That(maxCameraError, Is.LessThanOrEqualTo(MaxCameraErrorThreshold), "Camera chase position error should remain bounded.");
                Assert.That(maxAnchorError, Is.LessThanOrEqualTo(MaxAnchorErrorThreshold), "Anchor error should remain bounded.");
                Assert.That(flipAssistEndFrame, Is.GreaterThan(flipAssistStartFrame), "Assist should return to inactive in the recovery segment.");
                Assert.That(recoveryCompleteFrame, Is.GreaterThanOrEqualTo(recoveryStartFrame), "Recovery completion should occur after assist ends.");
                Assert.That(recoveryCompleteFrame - recoveryStartFrame, Is.LessThanOrEqualTo(RecoverWindowFrames), "Recovery after assist should be quick.");
            }
            finally
            {
                WriteArtifacts();
            }
        }

        public void RunSafetyOnly()
        {
            ResetForScenario();
            for (int i = 0; i < WarmupFrames; i++)
            {
                StepFrame(Vector3.zero, "before");
            }

            for (int i = 0; i < FlipFrames; i++)
            {
                StepFrame(new Vector3(0f, FlipAngularVelocity, 0f), "flip");
            }

            for (int i = 0; i < RecoveryFrames; i++)
            {
                StepFrame(Vector3.zero, "after");
            }

            Assert.That(visualMode, Is.EqualTo(PrototypeShipVisualMode.GeneratedPrimitives), "This safety-only path should cover the generated fallback.");
            Assert.That(followCamera.CameraModeName, Is.EqualTo("ChaseLocked"), "Camera should be in ChaseLocked for the assist scenario.");
            Assert.That(unsafeViewportSamples, Is.EqualTo(0), scenarioName + " should keep ship or anchor in the safe viewport zone.");
            Assert.That(assistsDuringFlip, Is.GreaterThan(0), scenarioName + " should activate flip assist during high angular velocity.");
            Assert.That(maxCameraError, Is.LessThanOrEqualTo(MaxCameraErrorThreshold), scenarioName + " camera chase position error should remain bounded.");
            Assert.That(maxAnchorError, Is.LessThanOrEqualTo(MaxAnchorErrorThreshold), scenarioName + " anchor error should remain bounded.");
        }

        public void Dispose()
        {
            Physics.simulationMode = previousSimulationMode;
            Time.fixedDeltaTime = previousFixedDeltaTime;
        }

        private void ResetForScenario()
        {
            controller.ResetFlightState(Vector3.zero, Quaternion.identity, true);
            body.angularVelocity = Vector3.zero;
            body.linearVelocity = Vector3.zero;
            body.inertiaTensor = Vector3.one;
            followCamera.ResetFraming();
            followCamera.SnapNextFrame();
            Physics.SyncTransforms();
            cameraLateUpdate.Invoke(followCamera, null);
        }

        private void StepFrame(Vector3 angularVelocity, string phase)
        {
            sampleIndex++;
            body.angularVelocity = angularVelocity;

            fixedUpdate.Invoke(controller, null);
            Physics.Simulate(fixedDeltaTime);
            Physics.SyncTransforms();
            cameraLateUpdate.Invoke(followCamera, null);
            simulatedTime += fixedDeltaTime;

            FlipChaseSample sample = CaptureSample(phase);
            csv.WriteLine(sample.ToCsvLine());

            if (sample.safeViewport)
            {
                safeViewportSamples++;
            }
            else
            {
                unsafeViewportSamples++;
            }

            if (sample.flipCameraAssistActive)
            {
                flipAssistObserved = true;
                flipAssistFrames++;
                if (phase == "flip")
                {
                    assistsDuringFlip++;
                }

                if (flipAssistStartFrame < 0)
                {
                    flipAssistStartFrame = sampleIndex;
                }
            }
            else if (flipAssistStartFrame >= 0 && flipAssistEndFrame < 0 && phase == "after")
            {
                flipAssistEndFrame = sampleIndex;
                recoveryStartFrame = sampleIndex;
            }

            maxCameraError = Mathf.Max(maxCameraError, sample.cameraPositionError);

            maxAnchorError = Mathf.Max(maxAnchorError, sample.anchorError);
            if (sample.angularVelocityMagnitude > maxAngularVelocity)
            {
                maxAngularVelocity = sample.angularVelocityMagnitude;
                maxAngularVelocityFrame = sampleIndex;
            }

            if (recoveryStartFrame >= 0 && recoveryCompleteFrame < 0 && sample.cameraPositionError <= RecoverErrorThreshold)
            {
                recoveryCompleteFrame = sampleIndex;
            }
        }

        private FlipChaseSample CaptureSample(string phase)
        {
            Vector3 viewportTarget = ResolveViewportForReporting();
            Vector3 focusPoint = followCamera.FocusPoint;
            Vector3 shipViewport = ProjectToViewport(ship.transform.position);
            Vector3 anchorViewport = followCamera.ViewportTargetPosition != Vector3.zero ? ProjectToViewport(followCamera.ViewportTargetPosition) : Vector3.zero;
            bool viewportSafe = IsViewportSafe(viewportTarget) || IsViewportSafe(shipViewport) || IsViewportSafe(anchorViewport);
            Vector3 desiredCameraPosition = ResolveDesiredCameraPosition();
            float cameraError = followCamera.AnchorError;

            return new FlipChaseSample
            {
                time = simulatedTime,
                phase = phase,
                frame = sampleIndex,
                autopilotState = followCamera.CameraAutopilotState.ToString(),
                angularVelocityMagnitude = followCamera.CameraAngularVelocityMagnitude,
                flipCameraAssistActive = followCamera.IsAutopilotFlipCameraAssistActive,
                cameraMode = followCamera.CameraModeName,
                focusPoint = focusPoint,
                viewportPoint = viewportTarget,
                cameraPosition = followCamera.transform.position,
                desiredCameraPosition = desiredCameraPosition,
                cameraPositionError = cameraError,
                followDistance = followCamera.EffectiveDistance,
                chaseReferenceMode = GetChaseReferenceMode(),
                visualBoundsRadius = followCamera.VisualBoundsRadius,
                anchorError = followCamera.AnchorError,
                safeViewport = viewportSafe
            };
        }

        private Vector3 ResolveDesiredCameraPosition()
        {
            float followHeightSource = ResolveFollowHeight();
            float baseDistance = (float)resolveBaseDistance.Invoke(followCamera, new object[] { followHeightSource });
            object mode = Enum.ToObject(cameraModeEnumType, followCamera.CameraMode);
            Vector3 lookTarget = followCamera.CameraModeName == "ChaseLocked" ? followCamera.SmoothedFocusPoint : (Vector3)getLookTargetFromMode.Invoke(followCamera, new[] { mode });
            Vector3 viewDirection = (Vector3)getViewDirectionFromPivot.Invoke(followCamera, new object[] { mode, followHeightSource, baseDistance });
            float followDistance = (float)resolveEffectiveDistance.Invoke(followCamera, new object[] { baseDistance, lookTarget, viewDirection });

            return lookTarget + viewDirection * followDistance;
        }

        private Vector3 ResolveViewportForReporting()
        {
            if (mainCamera == null)
            {
                return Vector3.zero;
            }

            if (followCamera.IsAutopilotFlipCameraAssistActive && followCamera.LastViewportPoint != Vector3.zero)
            {
                return followCamera.LastViewportPoint;
            }

            return ProjectToViewport(followCamera.ViewportTargetPosition);
        }

        private Vector3 ProjectToViewport(Vector3 worldPoint)
        {
            return mainCamera == null ? Vector3.zero : mainCamera.WorldToViewportPoint(worldPoint);
        }

        private static bool IsViewportSafe(Vector3 viewportPoint)
        {
            return viewportPoint.z > 0f
                && viewportPoint.x >= SafeViewportMin
                && viewportPoint.x <= SafeViewportMax
                && viewportPoint.y >= SafeViewportMin
                && viewportPoint.y <= SafeViewportMax;
        }

        private string GetChaseReferenceMode()
        {
            if (autopilotFlipReferenceModeField == null)
            {
                return "Unknown";
            }

            object value = autopilotFlipReferenceModeField.GetValue(followCamera);
            return value != null ? value.ToString() : "Unknown";
        }

        private float ResolveFollowHeight()
        {
            if (targetStatsField == null)
            {
                return GetPrivateField<float>(followCamera, "height");
            }

            object targetStats = targetStatsField.GetValue(followCamera);
            if (targetStats is ShipStats shipStats)
            {
                return shipStats.FollowHeight;
            }

            return GetPrivateField<float>(followCamera, "height");
        }

        private void WriteHeaders()
        {
            csv.WriteLine("time,autopilotState,angularVelocityMagnitude,flipCameraAssistActive,cameraMode,focusPoint.x,focusPoint.y,focusPoint.z,viewport.x,viewport.y,viewport.z,cameraPosition.x,cameraPosition.y,cameraPosition.z,desiredCameraPosition.x,desiredCameraPosition.y,desiredCameraPosition.z,cameraPositionError,followDistance,chaseReferenceMode,visualBoundsRadius,anchorError");
        }

        private void WriteArtifacts()
        {
            string csvPath = Path.Combine(evidenceRoot, "performance", "autopilot-flip-camera.csv");
            string protocolPath = Path.Combine(evidenceRoot, "test-protocol.md");
            File.WriteAllText(csvPath, csv.ToString());
            File.WriteAllText(protocolPath, protocol.ToString());
            Assert.That(new FileInfo(csvPath).Length, Is.GreaterThan(0), csvPath);
            Assert.That(new FileInfo(protocolPath).Length, Is.GreaterThan(0), protocolPath);
        }

        private void CaptureScreenshot(string fileName)
        {
            string path = Path.Combine(screenshotRoot, fileName);
            if (mainCamera == null)
            {
                WritePlaceholderScreenshot(path, "Main camera unavailable; wrote placeholder.");
                return;
            }

            if (!CanCaptureWithRenderTexture())
            {
                WritePlaceholderScreenshot(path, "Headless/unrenderable graphics environment; wrote placeholder.");
                return;
            }

            RenderTexture previousTarget = mainCamera.targetTexture;
            RenderTexture previousActive = RenderTexture.active;
            RenderTexture renderTexture = null;
            Texture2D texture = null;

            try
            {
                renderTexture = new RenderTexture(1280, 720, 24, RenderTextureFormat.ARGB32);
                if (!renderTexture.IsCreated())
                {
                    renderTexture.Create();
                }

                if (!renderTexture.IsCreated())
                {
                    throw new InvalidOperationException("RenderTexture could not be created.");
                }

                texture = new Texture2D(renderTexture.width, renderTexture.height, TextureFormat.RGB24, false);
                mainCamera.targetTexture = renderTexture;
                cameraLateUpdate.Invoke(followCamera, null);
                mainCamera.Render();
                RenderTexture.active = renderTexture;
                texture.ReadPixels(new Rect(0, 0, renderTexture.width, renderTexture.height), 0, 0);
                texture.Apply(false);
                File.WriteAllBytes(path, texture.EncodeToPNG());
            }
            catch (Exception ex)
            {
                protocol.WriteLine($"- Screenshot '{fileName}' fallback (headless/unrenderable): {ex.GetType().Name}.");
                WritePlaceholderScreenshot(path, "Render-to-texture failed; wrote placeholder.");
            }
            finally
            {
                mainCamera.targetTexture = previousTarget;
                RenderTexture.active = previousActive;

                if (texture != null)
                {
                    Object.DestroyImmediate(texture);
                }

                if (renderTexture != null)
                {
                    renderTexture.Release();
                    Object.DestroyImmediate(renderTexture);
                }
            }
        }

        private bool CanCaptureWithRenderTexture()
        {
            return SystemInfo.graphicsDeviceType != UnityEngine.Rendering.GraphicsDeviceType.Null;
        }

        private void WritePlaceholderScreenshot(string path, string reason)
        {
            protocol.WriteLine("- Screenshot placeholder: " + Path.GetFileName(path) + " -> " + reason);

            Texture2D texture = null;
            try
            {
                texture = new Texture2D(4, 4, TextureFormat.RGB24, false);
                for (int i = 0; i < texture.width * texture.height; i++)
                {
                    texture.SetPixel(i % texture.width, i / texture.width, Color.black);
                }

                texture.Apply(false);
                File.WriteAllBytes(path, texture.EncodeToPNG());
            }
            finally
            {
                if (texture != null)
                {
                    Object.DestroyImmediate(texture);
                }
            }
        }

        private static string F(float value)
        {
            return value.ToString("0.######", Invariant);
        }

        private static T GetPrivateField<T>(object target, string fieldName)
        {
            FieldInfo field = target.GetType().GetField(fieldName, NonPublicInstance);
            if (field == null)
            {
                return default;
            }

            return (T)field.GetValue(target);
        }
    }

    private struct FlipChaseSample
    {
        public float time;
        public string phase;
        public int frame;
        public string autopilotState;
        public float angularVelocityMagnitude;
        public bool flipCameraAssistActive;
        public string cameraMode;
        public Vector3 focusPoint;
        public Vector3 viewportPoint;
        public Vector3 cameraPosition;
        public Vector3 desiredCameraPosition;
        public float cameraPositionError;
        public float followDistance;
        public string chaseReferenceMode;
        public float visualBoundsRadius;
        public float anchorError;
        public bool safeViewport;

        public string ToCsvLine()
        {
            return Csv(time) + "," + autopilotState + "," + Csv(angularVelocityMagnitude) + "," + flipCameraAssistActive + ","
                + cameraMode + "," + Csv(focusPoint) + "," + Csv(viewportPoint) + "," + Csv(cameraPosition) + ","
                + Csv(desiredCameraPosition) + "," + Csv(cameraPositionError) + "," + Csv(followDistance) + ","
                + chaseReferenceMode + "," + Csv(visualBoundsRadius) + "," + Csv(anchorError);
        }

        private static string Csv(Vector3 value)
        {
            return Csv(value.x) + "," + Csv(value.y) + "," + Csv(value.z);
        }

        private static string Csv(float value)
        {
            return value.ToString("0.######", CultureInfo.InvariantCulture);
        }
    }
}
