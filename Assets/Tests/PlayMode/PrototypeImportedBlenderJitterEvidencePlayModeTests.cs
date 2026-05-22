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

public class PrototypeImportedBlenderJitterEvidencePlayModeTests
{
    private const string ScenePath = "Assets/Scenes/PrototypeBootstrapHost.unity";
    private const string ChangeName = "fix-imported-blender-movement-jitter-v1";
    private const int ScenarioFrames = 150;
    private const BindingFlags NonPublicInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [Test]
    [Timeout(120000)]
    public void PrototypeBootstrapHostImportedBlenderJitterEvidence()
    {
        Assert.That(Application.isPlaying, Is.True, "This evidence test must run in Unity PlayMode.");
#if UNITY_EDITOR
        if (SceneManager.GetActiveScene().path != ScenePath)
        {
            EditorSceneManager.LoadSceneInPlayMode(ScenePath, new LoadSceneParameters(LoadSceneMode.Single));
        }
#endif

        Exception failure = null;
        JitterEvidenceRunner runner = null;

        try
        {
            runner = JitterEvidenceRunner.Create();
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

    private sealed class JitterEvidenceRunner : IDisposable
    {
        private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

        private readonly GameObject ship;
        private readonly PlayerShipController controller;
        private readonly Rigidbody body;
        private readonly RcsThrusterController rcs;
        private readonly PrototypeShipVisualSwitcher switcher;
        private readonly PrototypeDockingApproachAssist dockingAssist;
        private readonly PrototypeWaypointAutopilot autopilot;
        private readonly PrototypeMomentumAssist momentumAssist;
        private readonly WeaponRecoilStabilizer weaponStabilizer;
        private readonly Camera mainCamera;
        private readonly SimpleFollowCamera followCamera;
        private readonly MethodInfo fixedUpdate;
        private readonly MethodInfo cameraLateUpdate;
        private readonly SimulationMode previousSimulationMode;
        private readonly float fixedDeltaTime;
        private readonly Vector3 startPosition;
        private readonly string evidenceRoot;
        private readonly string screenshotRoot;
        private readonly StringWriter csv = new StringWriter(Invariant);
        private readonly StringWriter log = new StringWriter(Invariant);
        private readonly StringWriter protocol = new StringWriter(Invariant);
        private float simulatedTime;

        private JitterEvidenceRunner(
            GameObject ship,
            PlayerShipController controller,
            Rigidbody body,
            RcsThrusterController rcs,
            PrototypeShipVisualSwitcher switcher,
            PrototypeDockingApproachAssist dockingAssist,
            PrototypeWaypointAutopilot autopilot,
            PrototypeMomentumAssist momentumAssist,
            WeaponRecoilStabilizer weaponStabilizer,
            Camera mainCamera,
            SimpleFollowCamera followCamera,
            string evidenceRoot)
        {
            this.ship = ship;
            this.controller = controller;
            this.body = body;
            this.rcs = rcs;
            this.switcher = switcher;
            this.dockingAssist = dockingAssist;
            this.autopilot = autopilot;
            this.momentumAssist = momentumAssist;
            this.weaponStabilizer = weaponStabilizer;
            this.mainCamera = mainCamera;
            this.followCamera = followCamera;
            this.evidenceRoot = evidenceRoot;
            screenshotRoot = Path.Combine(evidenceRoot, "screenshots");
            fixedUpdate = typeof(PlayerShipController).GetMethod("FixedUpdate", NonPublicInstance);
            cameraLateUpdate = typeof(SimpleFollowCamera).GetMethod("LateUpdate", NonPublicInstance);
            previousSimulationMode = Physics.simulationMode;
            fixedDeltaTime = Time.fixedDeltaTime > 0f ? Time.fixedDeltaTime : 0.02f;
            startPosition = ship.transform.position;
            Physics.simulationMode = SimulationMode.Script;
        }

        public static JitterEvidenceRunner Create()
        {
            PrototypeBootstrap bootstrap = Object.FindAnyObjectByType<PrototypeBootstrap>();
            if (bootstrap == null)
            {
                bootstrap = new GameObject("ImportedBlenderJitterBootstrap").AddComponent<PrototypeBootstrap>();
            }

            if (GameObject.Find("PrototypeShip") == null)
            {
                bootstrap.SetBuildMode(PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault, false);
                bootstrap.BuildPrototype(PrototypeShipVariant.Baseline());
            }

            PrototypeShipVisualSwitcher switcher = Object.FindAnyObjectByType<PrototypeShipVisualSwitcher>();
            if (switcher == null)
            {
                switcher = new GameObject("PrototypeShipVisualSwitcher_Manager").AddComponent<PrototypeShipVisualSwitcher>();
            }

            switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
            GameObject ship = GameObject.Find("PrototypeShip");
            Assert.NotNull(ship, "PrototypeShip must exist.");

            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody body = ship.GetComponent<Rigidbody>();
            RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
            PrototypeDockingApproachAssist dockingAssist = ship.GetComponent<PrototypeDockingApproachAssist>();
            PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
            PrototypeMomentumAssist momentumAssist = ship.GetComponent<PrototypeMomentumAssist>();
            WeaponRecoilStabilizer weaponStabilizer = ship.GetComponent<WeaponRecoilStabilizer>();
            Camera mainCamera = Camera.main;
            SimpleFollowCamera followCamera = mainCamera != null ? mainCamera.GetComponent<SimpleFollowCamera>() : null;

            Assert.NotNull(controller, "PrototypeShip must keep PlayerShipController.");
            Assert.NotNull(body, "PrototypeShip must keep Rigidbody.");
            Assert.NotNull(rcs, "PrototypeShip must keep RcsThrusterController.");
            Assert.NotNull(mainCamera, "Scene must have a Main Camera.");
            Assert.NotNull(followCamera, "Main Camera must use SimpleFollowCamera.");

            string root = Directory.GetCurrentDirectory();
            string evidenceRoot = Path.Combine(root, ".devtoolbox", "specs", "changes", ChangeName, "tests");
            Directory.CreateDirectory(Path.Combine(evidenceRoot, "logs"));
            Directory.CreateDirectory(Path.Combine(evidenceRoot, "performance"));
            Directory.CreateDirectory(Path.Combine(evidenceRoot, "screenshots"));

            return new JitterEvidenceRunner(
                ship,
                controller,
                body,
                rcs,
                switcher,
                dockingAssist,
                autopilot,
                momentumAssist,
                weaponStabilizer,
                mainCamera,
                followCamera,
                evidenceRoot);
        }

        public void RunAll()
        {
            Assert.NotNull(fixedUpdate, "PlayerShipController.FixedUpdate reflection hook must exist.");
            Assert.NotNull(cameraLateUpdate, "SimpleFollowCamera.LateUpdate reflection hook must exist.");

            WriteHeaders();
            protocol.WriteLine("# Imported Blender Movement Jitter Evidence");
            protocol.WriteLine();
            protocol.WriteLine("- Scene: " + SceneManager.GetActiveScene().path);
            protocol.WriteLine("- Unity: " + Application.unityVersion);
            protocol.WriteLine("- Driver: PlayMode scene, PlayerShipController test hook, scripted physics stepping, SimpleFollowCamera LateUpdate.");
            protocol.WriteLine("- Goal: classify physics vs imported visual vs camera/focus vs assist-conflict jitter after the camera smoothing fix.");
            protocol.WriteLine();

            ScenarioMetrics chase = RunScenario("post-chase-scout-w-sas-on-docking-on", PrototypeShipVisualMode.ImportedDemoScout, 0, true, true, true, false, false, false, false, "chase-locked-translation-before-after.png");
            ScenarioMetrics orbit = RunScenario("post-orbit-scout-w", PrototypeShipVisualMode.ImportedDemoScout, 1, true, true, true, false, false, false, false, "orbit-translation-comparison.png");
            ScenarioMetrics generated = RunScenario("post-chase-generated-w", PrototypeShipVisualMode.GeneratedPrimitives, 0, true, true, true, false, false, false, false, null);
            ScenarioMetrics sasOff = RunScenario("post-chase-scout-w-sas-off", PrototypeShipVisualMode.ImportedDemoScout, 0, false, true, true, false, false, false, false, null);
            ScenarioMetrics dockingOff = RunScenario("post-chase-scout-w-docking-off", PrototypeShipVisualMode.ImportedDemoScout, 0, true, false, true, false, false, false, false, null);
            ScenarioMetrics left = RunScenario("post-chase-scout-a-left", PrototypeShipVisualMode.ImportedDemoScout, 0, true, false, false, false, true, false, false, null);
            ScenarioMetrics up = RunScenario("post-chase-scout-h-up", PrototypeShipVisualMode.ImportedDemoScout, 0, true, false, false, false, false, false, true, null);
            ScenarioMetrics cargo = RunScenario("post-chase-cargo-w", PrototypeShipVisualMode.ImportedDemoCargo, 0, true, false, true, false, false, false, false, null);

            string classification = Classify(chase);
            protocol.WriteLine("## Classification");
            protocol.WriteLine("- Primary post-fix classification: " + classification);
            protocol.WriteLine("- Chase camera-minus-focus max: " + F(chase.cameraMinusFocusDeltaMax));
            protocol.WriteLine("- Orbit camera-minus-focus max: " + F(orbit.cameraMinusFocusDeltaMax));
            protocol.WriteLine("- Generated camera-minus-focus max: " + F(generated.cameraMinusFocusDeltaMax));
            protocol.WriteLine("- SAS-off camera-minus-focus max: " + F(sasOff.cameraMinusFocusDeltaMax));
            protocol.WriteLine("- Docking-off camera-minus-focus max: " + F(dockingOff.cameraMinusFocusDeltaMax));
            protocol.WriteLine("- Left force dot min: " + F(left.forceDirectionDotMin));
            protocol.WriteLine("- Up force dot min: " + F(up.forceDirectionDotMin));
            protocol.WriteLine("- Cargo classification: " + Classify(cargo));
            protocol.WriteLine();

            WriteArtifacts();
        }

        public void Dispose()
        {
            Physics.simulationMode = previousSimulationMode;
        }

        private ScenarioMetrics RunScenario(
            string name,
            PrototypeShipVisualMode visualMode,
            int cameraMode,
            bool sasEnabled,
            bool dockingEnabled,
            bool w,
            bool s,
            bool a,
            bool d,
            bool h,
            string screenshotName)
        {
            ResetForScenario(visualMode, cameraMode, sasEnabled, dockingEnabled);
            Transform visualRoot = ship.transform.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName);
            Transform functionalRig = ship.transform.Find(PrototypeFunctionalShipBinder.FunctionalSocketRigName);
            ScenarioMetrics metrics = new ScenarioMetrics(name);
            Vector3 expectedDirection = ResolveExpectedDirection(w, s, a, d, h);
            ScenarioFrame previous = CaptureFrame(name, 0, "initial", visualRoot, functionalRig);
            Vector3 initialVisualLocalPosition = visualRoot != null ? visualRoot.localPosition : Vector3.zero;
            Quaternion initialVisualLocalRotation = visualRoot != null ? visualRoot.localRotation : Quaternion.identity;
            Vector3 initialVisualLocalScale = visualRoot != null ? visualRoot.localScale : Vector3.zero;
            Vector3 initialRigLocalPosition = functionalRig != null ? functionalRig.localPosition : Vector3.zero;
            Quaternion initialRigLocalRotation = functionalRig != null ? functionalRig.localRotation : Quaternion.identity;
            Vector3 initialRigLocalScale = functionalRig != null ? functionalRig.localScale : Vector3.zero;
            int startBoundsRefresh = followCamera.VisualBoundsRefreshCount;
            int startNozzleRefresh = rcs.NozzleRefreshCount;

            for (int frame = 1; frame <= ScenarioFrames; frame++)
            {
                controller.ApplyModeSpecificInputForTests(w, s, a, d, false, false, h, false, false, false);
                fixedUpdate.Invoke(controller, null);
                Physics.Simulate(fixedDeltaTime);
                Physics.SyncTransforms();
                cameraLateUpdate.Invoke(followCamera, null);
                simulatedTime += fixedDeltaTime;

                ScenarioFrame current = CaptureFrame(name, frame, "FixedUpdate/LateUpdate", visualRoot, functionalRig);
                metrics.Accumulate(previous, current, controller, body, expectedDirection);

                if (visualRoot != null)
                {
                    metrics.visualLocalPositionMaxError = Mathf.Max(metrics.visualLocalPositionMaxError, Vector3.Distance(visualRoot.localPosition, initialVisualLocalPosition));
                    metrics.visualLocalRotationMaxError = Mathf.Max(metrics.visualLocalRotationMaxError, Quaternion.Angle(visualRoot.localRotation, initialVisualLocalRotation));
                    metrics.visualLocalScaleMaxError = Mathf.Max(metrics.visualLocalScaleMaxError, Vector3.Distance(visualRoot.localScale, initialVisualLocalScale));
                }

                if (functionalRig != null)
                {
                    metrics.functionalRigLocalPositionMaxError = Mathf.Max(metrics.functionalRigLocalPositionMaxError, Vector3.Distance(functionalRig.localPosition, initialRigLocalPosition));
                    metrics.functionalRigLocalRotationMaxError = Mathf.Max(metrics.functionalRigLocalRotationMaxError, Quaternion.Angle(functionalRig.localRotation, initialRigLocalRotation));
                    metrics.functionalRigLocalScaleMaxError = Mathf.Max(metrics.functionalRigLocalScaleMaxError, Vector3.Distance(functionalRig.localScale, initialRigLocalScale));
                }

                previous = current;
            }

            metrics.visualBoundsRefreshDelta = followCamera.VisualBoundsRefreshCount - startBoundsRefresh;
            metrics.nozzleRefreshDelta = rcs.NozzleRefreshCount - startNozzleRefresh;
            metrics.Finish();
            LogScenario(metrics);

            if (!string.IsNullOrEmpty(screenshotName))
            {
                CaptureScreenshot(screenshotName);
            }

            return metrics;
        }

        private void ResetForScenario(PrototypeShipVisualMode visualMode, int cameraMode, bool sasEnabled, bool dockingEnabled)
        {
            switcher.SelectVisualMode(visualMode);
            controller.ResetFlightState(startPosition, Quaternion.identity, true);
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;
            controller.ClearExternalFlightAssistRequest();
            controller.SetMainThrottle(0f);
            controller.SetControlMode(FlightControlMode.Translation);
            controller.SetRcsEnabled(true);
            controller.SetSasEnabled(sasEnabled);
            autopilot?.Abort("jitter evidence reset");
            autopilot?.SetNavigationDebugPlanningActive(false);
            momentumAssist?.Abort("jitter evidence reset");
            weaponStabilizer?.ClearPendingRequest("jitter evidence reset");
            dockingAssist?.SetAssistEnabled(dockingEnabled);
            followCamera.ResetFraming();
            for (int i = 0; i < cameraMode; i++)
            {
                followCamera.CycleCameraMode();
            }

            followCamera.SnapNextFrame();
            Physics.SyncTransforms();
            cameraLateUpdate.Invoke(followCamera, null);
        }

        private ScenarioFrame CaptureFrame(string scenario, int frame, string phase, Transform visualRoot, Transform functionalRig)
        {
            ScenarioFrame sample = new ScenarioFrame
            {
                scenario = scenario,
                frame = frame,
                phase = phase,
                time = simulatedTime,
                visualMode = switcher.SelectedVisualMode.ToString(),
                controlMode = controller.ControlMode.ToString(),
                sasEnabled = controller.EffectiveSasEnabled,
                rcsEnabled = controller.RcsEnabled,
                dockingAssistEnabled = dockingAssist != null && dockingAssist.AssistEnabled,
                hasExternalAssist = controller.HasExternalFlightAssistRequest,
                externalAssistSource = controller.HasExternalFlightAssistRequest ? controller.LastExternalFlightAssistRequest.source.ToString() : "None",
                shipPosition = ship.transform.position,
                shipRotationEuler = ship.transform.rotation.eulerAngles,
                rigidbodyPosition = body.position,
                linearVelocity = body.linearVelocity,
                angularVelocity = body.angularVelocity,
                visualRootPosition = visualRoot != null ? visualRoot.position : Vector3.zero,
                visualRootLocalPosition = visualRoot != null ? visualRoot.localPosition : Vector3.zero,
                visualRootLocalRotationEuler = visualRoot != null ? visualRoot.localRotation.eulerAngles : Vector3.zero,
                visualRootLocalScale = visualRoot != null ? visualRoot.localScale : Vector3.zero,
                functionalSocketRigPosition = functionalRig != null ? functionalRig.position : Vector3.zero,
                cameraPosition = followCamera.transform.position,
                cameraRotationEuler = followCamera.transform.rotation.eulerAngles,
                cameraFocusSource = followCamera.CameraFocusSource,
                cameraFocusPoint = followCamera.FocusPoint,
                cameraAnchorError = followCamera.AnchorError,
                visualBoundsCenter = followCamera.VisualBoundsCenter,
                visualBoundsRadius = followCamera.VisualBoundsRadius,
                visualBoundsRefreshCount = followCamera.VisualBoundsRefreshCount,
                nozzleRefreshCount = rcs.NozzleRefreshCount,
                desiredForce = controller.LastRcsDesiredForceWorld,
                actualForce = controller.LastRcsActualForceWorld,
                residualForce = controller.LastRcsResidualForceWorld,
                desiredTorque = controller.LastRcsDesiredTorqueWorld,
                actualTorque = controller.LastRcsActualTorqueWorld,
                residualTorque = controller.LastRcsResidualTorqueWorld,
                allocatorStatus = controller.LastRcsAllocatorStatus,
                translationAutoStopActive = controller.TranslationAutoStopActive,
                translationAutoStopForce = controller.TranslationAutoStopForceWorld,
                manualTranslationInputHeld = controller.ManualTranslationInputHeld,
                manualInputGraceUntil = controller.ManualInputGraceUntil
            };

            csv.WriteLine(sample.ToCsv());
            return sample;
        }

        private void LogScenario(ScenarioMetrics metrics)
        {
            string classification = Classify(metrics);
            protocol.WriteLine("## " + metrics.name);
            protocol.WriteLine("- Classification: " + classification);
            protocol.WriteLine("- Ship delta variance: " + F(metrics.shipDeltaVariance));
            protocol.WriteLine("- Visual-root minus ship-delta max: " + F(metrics.visualDeltaMinusShipDeltaMax));
            protocol.WriteLine("- Camera minus focus-delta max: " + F(metrics.cameraMinusFocusDeltaMax));
            protocol.WriteLine("- Focus delta max: " + F(metrics.focusDeltaMax));
            protocol.WriteLine("- Force direction min dot: " + F(metrics.forceDirectionDotMin));
            protocol.WriteLine("- Velocity direction min dot: " + F(metrics.velocityDirectionDotMin));
            protocol.WriteLine("- Force flip count: " + metrics.forceFlipCount);
            protocol.WriteLine("- AutoStop active frames: " + metrics.autoStopActiveFrames);
            protocol.WriteLine("- External assist conflict frames: " + metrics.externalAssistConflictFrames);
            protocol.WriteLine("- Visual local errors pos/rot/scale: " + F(metrics.visualLocalPositionMaxError) + " / " + F(metrics.visualLocalRotationMaxError) + " / " + F(metrics.visualLocalScaleMaxError));
            protocol.WriteLine("- Functional rig local errors pos/rot/scale: " + F(metrics.functionalRigLocalPositionMaxError) + " / " + F(metrics.functionalRigLocalRotationMaxError) + " / " + F(metrics.functionalRigLocalScaleMaxError));
            protocol.WriteLine("- Bounds/nozzle refresh deltas: " + metrics.visualBoundsRefreshDelta + " / " + metrics.nozzleRefreshDelta);
            protocol.WriteLine("- Max angular velocity: " + F(metrics.maxAngularVelocity));
            protocol.WriteLine("- Max camera anchor error: " + F(metrics.maxCameraAnchorError) + " (expected smoothing lag, not classified as jitter by itself)");
            protocol.WriteLine();

            log.WriteLine(metrics.name
                + " classification=" + classification
                + " shipVar=" + F(metrics.shipDeltaVariance)
                + " visualDeltaError=" + F(metrics.visualDeltaMinusShipDeltaMax)
                + " cameraFocusError=" + F(metrics.cameraMinusFocusDeltaMax)
                + " forceDot=" + F(metrics.forceDirectionDotMin)
                + " velocityDot=" + F(metrics.velocityDirectionDotMin)
                + " forceFlips=" + metrics.forceFlipCount
                + " autoStopFrames=" + metrics.autoStopActiveFrames
                + " externalConflicts=" + metrics.externalAssistConflictFrames
                + " boundsRefreshDelta=" + metrics.visualBoundsRefreshDelta
                + " nozzleRefreshDelta=" + metrics.nozzleRefreshDelta);
        }

        private string Classify(ScenarioMetrics metrics)
        {
            if (metrics.externalAssistConflictFrames > 0)
            {
                return "AssistConflict";
            }

            if (metrics.forceFlipCount > 0 || metrics.forceDirectionDotMin < 0.95f || metrics.velocityDirectionDotMin < 0.5f)
            {
                return "PhysicsOrAssistJitter";
            }

            if (metrics.visualLocalPositionMaxError > 0.001f
                || metrics.visualLocalRotationMaxError > 0.05f
                || metrics.visualLocalScaleMaxError > 0.001f
                || metrics.visualDeltaMinusShipDeltaMax > 0.05f)
            {
                return "ImportedVisualJitter";
            }

            if (metrics.cameraMinusFocusDeltaMax > 0.05f)
            {
                return "CameraFocusJitter";
            }

            return "NoSignificantJitterMeasured";
        }

        private void WriteHeaders()
        {
            csv.WriteLine("time,scenario,frame,phase,visualMode,controlMode,sasEnabled,rcsEnabled,dockingAssistEnabled,hasExternalAssist,externalAssistSource,ship.position.x,ship.position.y,ship.position.z,ship.rotation.x,ship.rotation.y,ship.rotation.z,rigidbody.position.x,rigidbody.position.y,rigidbody.position.z,linearVelocity.x,linearVelocity.y,linearVelocity.z,angularVelocity.x,angularVelocity.y,angularVelocity.z,importedVisualRoot.position.x,importedVisualRoot.position.y,importedVisualRoot.position.z,importedVisualRoot.localPosition.x,importedVisualRoot.localPosition.y,importedVisualRoot.localPosition.z,importedVisualRoot.localRotation.x,importedVisualRoot.localRotation.y,importedVisualRoot.localRotation.z,importedVisualRoot.localScale.x,importedVisualRoot.localScale.y,importedVisualRoot.localScale.z,functionalSocketRig.position.x,functionalSocketRig.position.y,functionalSocketRig.position.z,camera.position.x,camera.position.y,camera.position.z,camera.rotation.x,camera.rotation.y,camera.rotation.z,cameraFocusSource,cameraFocusPoint.x,cameraFocusPoint.y,cameraFocusPoint.z,cameraAnchorError,visualBoundsCenter.x,visualBoundsCenter.y,visualBoundsCenter.z,visualBoundsRadius,visualBoundsRefreshCount,nozzleRefreshCount,lastDesiredForce.x,lastDesiredForce.y,lastDesiredForce.z,lastActualForce.x,lastActualForce.y,lastActualForce.z,lastResidualForce.x,lastResidualForce.y,lastResidualForce.z,lastDesiredTorque.x,lastDesiredTorque.y,lastDesiredTorque.z,lastActualTorque.x,lastActualTorque.y,lastActualTorque.z,lastResidualTorque.x,lastResidualTorque.y,lastResidualTorque.z,allocatorStatus,translationAutoStopActive,translationAutoStopForce.x,translationAutoStopForce.y,translationAutoStopForce.z,manualTranslationInputHeld,manualInputGraceUntil");
        }

        private void WriteArtifacts()
        {
            string logPath = Path.Combine(evidenceRoot, "logs", "imported-blender-jitter.log");
            string csvPath = Path.Combine(evidenceRoot, "performance", "imported-blender-jitter.csv");
            string protocolPath = Path.Combine(evidenceRoot, "test-protocol.md");

            File.WriteAllText(logPath, log.ToString());
            File.WriteAllText(csvPath, csv.ToString());
            File.WriteAllText(protocolPath, protocol.ToString());

            Assert.That(new FileInfo(logPath).Length, Is.GreaterThan(0));
            Assert.That(new FileInfo(csvPath).Length, Is.GreaterThan(0));
            Assert.That(new FileInfo(protocolPath).Length, Is.GreaterThan(0));
        }

        private void CaptureScreenshot(string fileName)
        {
            string path = Path.Combine(screenshotRoot, fileName);
            RenderTexture previousTarget = mainCamera.targetTexture;
            RenderTexture previousActive = RenderTexture.active;
            RenderTexture renderTexture = null;
            Texture2D texture = null;

            try
            {
                renderTexture = new RenderTexture(1280, 720, 24, RenderTextureFormat.ARGB32);
                texture = new Texture2D(renderTexture.width, renderTexture.height, TextureFormat.RGB24, false);
                mainCamera.targetTexture = renderTexture;
                cameraLateUpdate.Invoke(followCamera, null);
                mainCamera.Render();
                RenderTexture.active = renderTexture;
                texture.ReadPixels(new Rect(0, 0, renderTexture.width, renderTexture.height), 0, 0);
                texture.Apply(false);
                File.WriteAllBytes(path, texture.EncodeToPNG());
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

        private Vector3 ResolveExpectedDirection(bool w, bool s, bool a, bool d, bool h)
        {
            Vector3 direction = Vector3.zero;
            if (w) direction += ship.transform.forward;
            if (s) direction -= ship.transform.forward;
            if (a) direction -= ship.transform.right;
            if (d) direction += ship.transform.right;
            if (h) direction += ship.transform.up;
            return direction.sqrMagnitude > 0.0001f ? direction.normalized : ship.transform.forward;
        }

        private static string F(float value)
        {
            return value.ToString("0.######", Invariant);
        }
    }

    private struct ScenarioFrame
    {
        public string scenario;
        public int frame;
        public string phase;
        public float time;
        public string visualMode;
        public string controlMode;
        public bool sasEnabled;
        public bool rcsEnabled;
        public bool dockingAssistEnabled;
        public bool hasExternalAssist;
        public string externalAssistSource;
        public Vector3 shipPosition;
        public Vector3 shipRotationEuler;
        public Vector3 rigidbodyPosition;
        public Vector3 linearVelocity;
        public Vector3 angularVelocity;
        public Vector3 visualRootPosition;
        public Vector3 visualRootLocalPosition;
        public Vector3 visualRootLocalRotationEuler;
        public Vector3 visualRootLocalScale;
        public Vector3 functionalSocketRigPosition;
        public Vector3 cameraPosition;
        public Vector3 cameraRotationEuler;
        public string cameraFocusSource;
        public Vector3 cameraFocusPoint;
        public float cameraAnchorError;
        public Vector3 visualBoundsCenter;
        public float visualBoundsRadius;
        public int visualBoundsRefreshCount;
        public int nozzleRefreshCount;
        public Vector3 desiredForce;
        public Vector3 actualForce;
        public Vector3 residualForce;
        public Vector3 desiredTorque;
        public Vector3 actualTorque;
        public Vector3 residualTorque;
        public string allocatorStatus;
        public bool translationAutoStopActive;
        public Vector3 translationAutoStopForce;
        public bool manualTranslationInputHeld;
        public float manualInputGraceUntil;

        public string ToCsv()
        {
            return Csv(time) + ","
                + scenario + ","
                + frame + ","
                + phase + ","
                + visualMode + ","
                + controlMode + ","
                + sasEnabled + ","
                + rcsEnabled + ","
                + dockingAssistEnabled + ","
                + hasExternalAssist + ","
                + externalAssistSource + ","
                + Csv(shipPosition) + ","
                + Csv(shipRotationEuler) + ","
                + Csv(rigidbodyPosition) + ","
                + Csv(linearVelocity) + ","
                + Csv(angularVelocity) + ","
                + Csv(visualRootPosition) + ","
                + Csv(visualRootLocalPosition) + ","
                + Csv(visualRootLocalRotationEuler) + ","
                + Csv(visualRootLocalScale) + ","
                + Csv(functionalSocketRigPosition) + ","
                + Csv(cameraPosition) + ","
                + Csv(cameraRotationEuler) + ","
                + cameraFocusSource + ","
                + Csv(cameraFocusPoint) + ","
                + Csv(cameraAnchorError) + ","
                + Csv(visualBoundsCenter) + ","
                + Csv(visualBoundsRadius) + ","
                + visualBoundsRefreshCount + ","
                + nozzleRefreshCount + ","
                + Csv(desiredForce) + ","
                + Csv(actualForce) + ","
                + Csv(residualForce) + ","
                + Csv(desiredTorque) + ","
                + Csv(actualTorque) + ","
                + Csv(residualTorque) + ","
                + allocatorStatus + ","
                + translationAutoStopActive + ","
                + Csv(translationAutoStopForce) + ","
                + manualTranslationInputHeld + ","
                + Csv(manualInputGraceUntil);
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

    private sealed class ScenarioMetrics
    {
        public readonly string name;
        public float visualDeltaMinusShipDeltaMax;
        public float cameraMinusFocusDeltaMax;
        public float focusDeltaMax;
        public float forceDirectionDotMin = 1f;
        public float velocityDirectionDotMin = 1f;
        public float maxAngularVelocity;
        public float maxCameraAnchorError;
        public float visualLocalPositionMaxError;
        public float visualLocalRotationMaxError;
        public float visualLocalScaleMaxError;
        public float functionalRigLocalPositionMaxError;
        public float functionalRigLocalRotationMaxError;
        public float functionalRigLocalScaleMaxError;
        public int forceFlipCount;
        public int autoStopActiveFrames;
        public int externalAssistConflictFrames;
        public int visualBoundsRefreshDelta;
        public int nozzleRefreshDelta;
        public float shipDeltaVariance;

        private float shipDeltaSum;
        private float shipDeltaSquaredSum;
        private int shipDeltaCount;

        public ScenarioMetrics(string name)
        {
            this.name = name;
        }

        public void Accumulate(ScenarioFrame previous, ScenarioFrame current, PlayerShipController controller, Rigidbody body, Vector3 expectedDirection)
        {
            Vector3 shipDelta = current.shipPosition - previous.shipPosition;
            Vector3 visualDelta = current.visualRootPosition - previous.visualRootPosition;
            Vector3 cameraDelta = current.cameraPosition - previous.cameraPosition;
            Vector3 focusDelta = current.cameraFocusPoint - previous.cameraFocusPoint;
            visualDeltaMinusShipDeltaMax = Mathf.Max(visualDeltaMinusShipDeltaMax, (visualDelta - shipDelta).magnitude);
            cameraMinusFocusDeltaMax = Mathf.Max(cameraMinusFocusDeltaMax, (cameraDelta - focusDelta).magnitude);
            focusDeltaMax = Mathf.Max(focusDeltaMax, focusDelta.magnitude);
            maxAngularVelocity = Mathf.Max(maxAngularVelocity, current.angularVelocity.magnitude);
            maxCameraAnchorError = Mathf.Max(maxCameraAnchorError, current.cameraAnchorError);

            float shipDeltaMagnitude = shipDelta.magnitude;
            shipDeltaSum += shipDeltaMagnitude;
            shipDeltaSquaredSum += shipDeltaMagnitude * shipDeltaMagnitude;
            shipDeltaCount++;

            if (current.actualForce.sqrMagnitude > 1f && expectedDirection.sqrMagnitude > 0.0001f)
            {
                float dot = Vector3.Dot(current.actualForce.normalized, expectedDirection.normalized);
                forceDirectionDotMin = Mathf.Min(forceDirectionDotMin, dot);
                if (dot < 0.95f)
                {
                    forceFlipCount++;
                }
            }

            if (previous.linearVelocity.sqrMagnitude > 0.01f && current.linearVelocity.sqrMagnitude > 0.01f)
            {
                velocityDirectionDotMin = Mathf.Min(
                    velocityDirectionDotMin,
                    Vector3.Dot(previous.linearVelocity.normalized, current.linearVelocity.normalized));
            }

            if (current.translationAutoStopActive)
            {
                autoStopActiveFrames++;
            }

            if (current.hasExternalAssist && current.externalAssistSource != "None")
            {
                externalAssistConflictFrames++;
            }
        }

        public void Finish()
        {
            if (shipDeltaCount <= 0)
            {
                shipDeltaVariance = 0f;
                return;
            }

            float mean = shipDeltaSum / shipDeltaCount;
            shipDeltaVariance = Mathf.Max(0f, (shipDeltaSquaredSum / shipDeltaCount) - (mean * mean));
        }
    }
}
