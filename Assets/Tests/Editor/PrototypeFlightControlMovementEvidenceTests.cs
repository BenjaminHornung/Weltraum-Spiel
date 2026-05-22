#if UNITY_EDITOR
using System;
using System.Collections;
using System.Globalization;
using System.IO;
using System.Reflection;
using NUnit.Framework;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Object = UnityEngine.Object;

public class PrototypeFlightControlMovementEvidenceTests
{
    private const string ScenePath = "Assets/Scenes/PrototypeBootstrapHost.unity";
    private const string ChangeName = "fix-flight-control-jitter-regression-v1";
    private const int LongHoldFrames = 60;
    private const int ShortHoldFrames = 30;

    [UnityTest]
    [Timeout(90000)]
    public IEnumerator PrototypeBootstrapHostImportedShipMovementEvidence()
    {
        EditorSceneManager.OpenScene(ScenePath);
        yield return new EnterPlayMode();
        yield return null;
        yield return null;

        EvidenceRunner runner = null;
        Exception failure = null;

        try
        {
            runner = EvidenceRunner.Create();
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

        yield return new ExitPlayMode();

        if (failure != null)
        {
            throw failure;
        }
    }

    private sealed class EvidenceRunner : IDisposable
    {
        private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

        private readonly GameObject ship;
        private readonly PlayerShipController controller;
        private readonly Rigidbody rigidbody;
        private readonly RcsThrusterController rcs;
        private readonly ShipPhysicsCore physicsCore;
        private readonly PrototypeShipVisualSwitcher switcher;
        private readonly PrototypeWaypointAutopilot autopilot;
        private readonly PrototypeMomentumAssist momentumAssist;
        private readonly WeaponRecoilStabilizer weaponStabilizer;
        private readonly Camera mainCamera;
        private readonly SimpleFollowCamera followCamera;
        private readonly MethodInfo fixedUpdate;
        private readonly MethodInfo cameraLateUpdate;
        private readonly StringWriter log = new StringWriter(Invariant);
        private readonly StringWriter csv = new StringWriter(Invariant);
        private readonly StringWriter protocol = new StringWriter(Invariant);
        private readonly string evidenceRoot;
        private readonly string screenshotRoot;
        private readonly string mirrorRoot;
        private readonly string mirrorScreenshotRoot;
        private readonly Vector3 startPosition;
        private readonly SimulationMode previousSimulationMode;
        private readonly float fixedDeltaTime;
        private float simulatedTime;
        private bool passed = true;

        private EvidenceRunner(
            GameObject ship,
            PlayerShipController controller,
            Rigidbody rigidbody,
            RcsThrusterController rcs,
            ShipPhysicsCore physicsCore,
            PrototypeShipVisualSwitcher switcher,
            PrototypeWaypointAutopilot autopilot,
            PrototypeMomentumAssist momentumAssist,
            WeaponRecoilStabilizer weaponStabilizer,
            Camera mainCamera,
            SimpleFollowCamera followCamera,
            string evidenceRoot,
            string mirrorRoot)
        {
            this.ship = ship;
            this.controller = controller;
            this.rigidbody = rigidbody;
            this.rcs = rcs;
            this.physicsCore = physicsCore;
            this.switcher = switcher;
            this.autopilot = autopilot;
            this.momentumAssist = momentumAssist;
            this.weaponStabilizer = weaponStabilizer;
            this.mainCamera = mainCamera;
            this.followCamera = followCamera;
            this.evidenceRoot = evidenceRoot;
            screenshotRoot = Path.Combine(evidenceRoot, "screenshots");
            this.mirrorRoot = mirrorRoot;
            mirrorScreenshotRoot = Path.Combine(mirrorRoot, "screenshots");
            startPosition = ship.transform.position;
            previousSimulationMode = Physics.simulationMode;
            fixedDeltaTime = Time.fixedDeltaTime > 0f ? Time.fixedDeltaTime : 0.02f;
            fixedUpdate = typeof(PlayerShipController).GetMethod("FixedUpdate", BindingFlags.Instance | BindingFlags.NonPublic);
            cameraLateUpdate = typeof(SimpleFollowCamera).GetMethod("LateUpdate", BindingFlags.Instance | BindingFlags.NonPublic);
            Physics.simulationMode = SimulationMode.Script;
        }

        public static EvidenceRunner Create()
        {
            PrototypeBootstrap bootstrap = Object.FindAnyObjectByType<PrototypeBootstrap>();
            if (bootstrap == null)
            {
                bootstrap = new GameObject("MovementEvidenceBootstrap").AddComponent<PrototypeBootstrap>();
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
            Assert.NotNull(ship, "PrototypeShip must exist after selecting ImportedDemoScout.");

            PlayerShipController controller = ship.GetComponent<PlayerShipController>();
            Rigidbody rigidbody = ship.GetComponent<Rigidbody>();
            RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
            ShipPhysicsCore physicsCore = ship.GetComponent<ShipPhysicsCore>();
            PrototypeWaypointAutopilot autopilot = ship.GetComponent<PrototypeWaypointAutopilot>();
            PrototypeMomentumAssist momentumAssist = ship.GetComponent<PrototypeMomentumAssist>();
            WeaponRecoilStabilizer weaponStabilizer = ship.GetComponent<WeaponRecoilStabilizer>();
            Camera mainCamera = Camera.main;
            SimpleFollowCamera followCamera = mainCamera != null ? mainCamera.GetComponent<SimpleFollowCamera>() : null;

            Assert.NotNull(controller, "PrototypeShip must keep PlayerShipController.");
            Assert.NotNull(rigidbody, "PrototypeShip must keep Rigidbody.");
            Assert.NotNull(rcs, "PrototypeShip must keep RcsThrusterController.");
            Assert.NotNull(physicsCore, "PrototypeShip must keep ShipPhysicsCore.");
            Assert.NotNull(mainCamera, "PrototypeBootstrapHost must have a Main Camera.");
            Assert.NotNull(followCamera, "Main Camera must use SimpleFollowCamera.");

            string root = Directory.GetCurrentDirectory();
            string evidenceRoot = Path.Combine(root, ".devtoolbox", "specs", "changes", ChangeName, "tests");
            string mirrorRoot = Path.Combine("C:\\tmp", "WeltraumSpielEvidence", ChangeName, "tests");
            Directory.CreateDirectory(Path.Combine(evidenceRoot, "logs"));
            Directory.CreateDirectory(Path.Combine(evidenceRoot, "performance"));
            Directory.CreateDirectory(Path.Combine(evidenceRoot, "screenshots"));
            Directory.CreateDirectory(Path.Combine(mirrorRoot, "logs"));
            Directory.CreateDirectory(Path.Combine(mirrorRoot, "performance"));
            Directory.CreateDirectory(Path.Combine(mirrorRoot, "screenshots"));

            return new EvidenceRunner(
                ship,
                controller,
                rigidbody,
                rcs,
                physicsCore,
                switcher,
                autopilot,
                momentumAssist,
                weaponStabilizer,
                mainCamera,
                followCamera,
                evidenceRoot,
                mirrorRoot);
        }

        public void RunAll()
        {
            Assert.NotNull(fixedUpdate, "PlayerShipController.FixedUpdate reflection hook must exist.");
            Assert.NotNull(cameraLateUpdate, "SimpleFollowCamera.LateUpdate reflection hook must exist.");

            WriteHeaders();
            WriteSetup();

            RunTranslationTests();
            RunAttitudeTests();
            RunSasComparison();
            RunMainThrusterTest();
            RunVisualSwitchTest();
            RunExternalAssistPriorityTest();

            WriteEvidenceArtifacts();
            WriteProtocolVerdict();
            WriteProtocolArtifacts();

            Assert.True(passed, "Movement evidence detected one or more failures. See " + evidenceRoot);
        }

        public void Dispose()
        {
            Physics.simulationMode = previousSimulationMode;
        }

        private void WriteHeaders()
        {
            csv.WriteLine("time,visualMode,controlMode,sasEnabled,rcsEnabled,hasExternalAssist,externalAssistSource,rcsTranslationCommand.x,rcsTranslationCommand.y,rcsTranslationCommand.z,rcsAttitudeCommand.x,rcsAttitudeCommand.y,rcsAttitudeCommand.z,linearVelocity.x,linearVelocity.y,linearVelocity.z,angularVelocity.x,angularVelocity.y,angularVelocity.z,lastDesiredForce.x,lastDesiredForce.y,lastDesiredForce.z,lastActualForce.x,lastActualForce.y,lastActualForce.z,lastResidualForce.x,lastResidualForce.y,lastResidualForce.z,lastDesiredTorque.x,lastDesiredTorque.y,lastDesiredTorque.z,lastActualTorque.x,lastActualTorque.y,lastActualTorque.z,lastResidualTorque.x,lastResidualTorque.y,lastResidualTorque.z,allocatorStatus,activeNozzleCount,installedNozzleCount,cameraFocusSource,cameraAnchorError,visualBoundsRefreshCount,nozzleRefreshCount");

            protocol.WriteLine("# Unity PlayMode Movement Evidence");
            protocol.WriteLine();
            protocol.WriteLine("- Scene: " + SceneManager.GetActiveScene().path);
            protocol.WriteLine("- Visual: " + switcher.SelectedVisualMode);
            protocol.WriteLine("- Unity: " + Application.unityVersion);
            protocol.WriteLine("- fixedDeltaTime: " + F(fixedDeltaTime));
            protocol.WriteLine("- Evidence root: " + evidenceRoot);
            protocol.WriteLine("- Log artifact: " + Path.Combine(evidenceRoot, "logs", "unity-playmode-movement.log"));
            protocol.WriteLine("- CSV artifact: " + Path.Combine(evidenceRoot, "performance", "movement-diagnostics.csv"));
            protocol.WriteLine("- Driver: live Unity PlayMode scene with PlayerShipController, RcsThrusterController, ShipPhysicsCore and SimpleFollowCamera.");
            protocol.WriteLine("- Input: simulated through PlayerShipController test hooks; physics is stepped in Unity PlayMode for deterministic evidence.");
            protocol.WriteLine();
        }

        private void WriteSetup()
        {
            int mainCameraCount = 0;
            Camera[] cameras = Camera.allCameras;
            for (int i = 0; i < cameras.Length; i++)
            {
                if (cameras[i] != null && cameras[i].isActiveAndEnabled && cameras[i].CompareTag("MainCamera"))
                {
                    mainCameraCount++;
                }
            }

            Mark("Exactly one active Main Camera", mainCameraCount == 1, "count=" + mainCameraCount);
            Mark("PrototypeShip has Rigidbody", rigidbody != null, "rb=" + (rigidbody != null));
            Mark("PrototypeShip has PlayerShipController", controller != null, "controller=" + (controller != null));
            Mark("PrototypeShip has RcsThrusterController", rcs != null, "rcs=" + (rcs != null));
            Mark("PrototypeShip has ShipPhysicsCore", physicsCore != null, "physicsCore=" + (physicsCore != null));
            Mark("Imported Scout selected", switcher.SelectedVisualMode == PrototypeShipVisualMode.ImportedDemoScout, "visual=" + switcher.SelectedVisualMode);
        }

        private void RunTranslationTests()
        {
            RunTranslationDirection("A-Translation-W-forward", true, false, false, false, false, false, false, false, ship.transform.forward, "translation-mode-imported-ship.png");
            RunTranslationDirection("A-Translation-S-back", false, true, false, false, false, false, false, false, -ship.transform.forward, null);
            RunTranslationDirection("A-Translation-A-left", false, false, true, false, false, false, false, false, -ship.transform.right, null);
            RunTranslationDirection("A-Translation-D-right", false, false, false, true, false, false, false, false, ship.transform.right, null);
            RunTranslationDirection("A-Translation-H-up", false, false, false, false, false, false, true, false, ship.transform.up, null);
            RunTranslationDirection("A-Translation-N-down", false, false, false, false, false, false, false, true, -ship.transform.up, null);
        }

        private void RunTranslationDirection(
            string phase,
            bool w,
            bool s,
            bool a,
            bool d,
            bool q,
            bool e,
            bool h,
            bool n,
            Vector3 expectedDirection,
            string screenshotName)
        {
            ResetFlight(true, FlightControlMode.Translation);
            RunInput(phase, w, s, a, d, q, e, h, n, false, false, LongHoldFrames);
            Vector3 direction = expectedDirection.normalized;
            float velocityDot = Vector3.Dot(rigidbody.linearVelocity, direction);
            float forceDot = Vector3.Dot(controller.LastRcsActualForceWorld, direction);
            float residualRatio = controller.LastRcsResidualForceWorld.magnitude / Mathf.Max(1f, controller.LastRcsDesiredForceWorld.magnitude);

            Mark(phase + " visible stable velocity", velocityDot > 0.25f, "velocityDot=" + F(velocityDot));
            Mark(phase + " actual force direction", forceDot > 1000f, "forceDot=" + F(forceDot));
            Mark(phase + " residual force small", residualRatio < 0.1f, "residualRatio=" + F(residualRatio));
            Mark(phase + " no unwanted torque", controller.LastRcsActualTorqueWorld.magnitude < 1f, "torque=" + F(controller.LastRcsActualTorqueWorld.magnitude));

            if (!string.IsNullOrEmpty(screenshotName))
            {
                CaptureScreenshot(screenshotName);
            }
        }

        private void RunAttitudeTests()
        {
            RunAttitudeDirection("B-Attitude-W-pitch", true, false, false, false, false, false, "normal-attitude-sas-on.png");
            RunAttitudeDirection("B-Attitude-S-pitch", false, true, false, false, false, false, null);
            RunAttitudeDirection("B-Attitude-A-yaw", false, false, true, false, false, false, null);
            RunAttitudeDirection("B-Attitude-D-yaw", false, false, false, true, false, false, null);
            RunAttitudeDirection("B-Attitude-Q-roll", false, false, false, false, true, false, null);
            RunAttitudeDirection("B-Attitude-E-roll", false, false, false, false, false, true, null);
        }

        private void RunAttitudeDirection(string phase, bool w, bool s, bool a, bool d, bool q, bool e, string screenshotName)
        {
            ResetFlight(true, FlightControlMode.Normal);
            RunInput(phase, w, s, a, d, q, e, false, false, false, false, LongHoldFrames);

            Mark(phase + " actual torque present", controller.LastRcsActualTorqueWorld.magnitude > 500f, "torque=" + F(controller.LastRcsActualTorqueWorld.magnitude));
            Mark(phase + " residual torque bounded", controller.LastRcsResidualTorqueWorld.magnitude < 25f, "residualTorque=" + F(controller.LastRcsResidualTorqueWorld.magnitude));
            Mark(phase + " linear force neutralized", controller.LastRcsActualForceWorld.magnitude < 50f, "force=" + F(controller.LastRcsActualForceWorld.magnitude));
            Mark(phase + " no linear drift", rigidbody.linearVelocity.magnitude < 0.25f, "velocity=" + F(rigidbody.linearVelocity.magnitude));

            if (!string.IsNullOrEmpty(screenshotName))
            {
                CaptureScreenshot(screenshotName);
            }
        }

        private void RunSasComparison()
        {
            ResetFlight(true, FlightControlMode.Normal);
            RunInput("C-SAS-on-yaw-impulse", false, false, false, true, false, false, false, false, false, false, ShortHoldFrames);
            float sasOnBeforeRelease = rigidbody.angularVelocity.magnitude;
            RunRelease("C-SAS-on-yaw-release", LongHoldFrames);
            Mark("C-SAS-on external assist idle", !controller.HasExternalFlightAssistRequest, "source=" + ExternalSource());
            Mark("C-SAS-on desired torque finite", IsFinite(controller.LastRcsSasDesiredTorqueLocal), "sasTorque=" + controller.LastRcsSasDesiredTorqueLocal);
            Mark("C-SAS-on damps angular velocity after input", rigidbody.angularVelocity.magnitude < sasOnBeforeRelease * 0.5f, "before=" + F(sasOnBeforeRelease) + " after=" + F(rigidbody.angularVelocity.magnitude));

            ResetFlight(false, FlightControlMode.Normal);
            RunInput("C-SAS-off-yaw-impulse", false, false, false, true, false, false, false, false, false, false, ShortHoldFrames);
            Vector3 angularBeforeRelease = rigidbody.angularVelocity;
            RunRelease("C-SAS-off-yaw-release", LongHoldFrames);
            Mark("C-SAS-off preserves physical drift", rigidbody.angularVelocity.magnitude > angularBeforeRelease.magnitude * 0.8f, "before=" + F(angularBeforeRelease.magnitude) + " after=" + F(rigidbody.angularVelocity.magnitude));
        }

        private void RunMainThrusterTest()
        {
            ResetFlight(true, FlightControlMode.Normal);
            controller.SetMainThrottle(0.25f);
            RunInput("D-main-throttle-025", false, false, false, false, false, false, false, false, false, false, 40);
            controller.SetMainThrottle(0.5f);
            RunInput("D-main-throttle-050", false, false, false, false, false, false, false, false, false, false, 40);
            controller.SetMainThrottle(1f);
            RunInput("D-main-throttle-100", false, false, false, false, false, false, false, false, false, false, 40);

            Mark("D-main-thruster accelerates forward", Vector3.Dot(rigidbody.linearVelocity, ship.transform.forward) > 0.5f, "velocity=" + rigidbody.linearVelocity);
            Mark("D-main-thruster no unexpected spin", rigidbody.angularVelocity.magnitude < 5f, "angularVelocity=" + F(rigidbody.angularVelocity.magnitude));
            CaptureScreenshot("main-thrust-imported-ship.png");
        }

        private void RunVisualSwitchTest()
        {
            ResetFlight(true, FlightControlMode.Translation);
            RunInput("E-f6-before-switch", true, false, false, false, false, false, false, false, false, false, 20);
            switcher.SelectVisualMode(PrototypeShipVisualMode.GeneratedPrimitives);
            Mark("E-F6 Generated visual active", switcher.SelectedVisualMode == PrototypeShipVisualMode.GeneratedPrimitives, "visual=" + switcher.SelectedVisualMode);
            Mark("E-F6 disables imported functional nozzle path", !rcs.UseImportedFunctionalSockets, "useImportedSockets=" + rcs.UseImportedFunctionalSockets);
            RunInput("E-f6-generated", true, false, false, false, false, false, false, false, false, false, 20);
            switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
            RunInput("E-f6-scout", true, false, false, false, false, false, false, false, false, false, 20);
            Mark("E-F6 re-enables imported functional nozzle path for Scout", rcs.UseImportedFunctionalSockets, "useImportedSockets=" + rcs.UseImportedFunctionalSockets);
            Mark("E-F6 Scout nozzles rebound", controller.InstalledRcsNozzleCount == 20, "installed=" + controller.InstalledRcsNozzleCount);
            switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoCargo);
            RunInput("E-f6-cargo", true, false, false, false, false, false, false, false, false, false, 20);
            Mark("E-F6 Cargo keeps imported functional nozzle path", rcs.UseImportedFunctionalSockets, "useImportedSockets=" + rcs.UseImportedFunctionalSockets);
            switcher.SelectVisualMode(PrototypeShipVisualMode.ImportedDemoScout);
            RunInput("E-f6-back-scout", true, false, false, false, false, false, false, false, false, false, 20);
            Mark("E-F6 returns to Imported Scout", switcher.SelectedVisualMode == PrototypeShipVisualMode.ImportedDemoScout, "visual=" + switcher.SelectedVisualMode);

            Mark("E-F6 keeps Rigidbody", ship.GetComponent<Rigidbody>() != null, "rb=" + (ship.GetComponent<Rigidbody>() != null));
            Mark("E-F6 keeps PlayerShipController", ship.GetComponent<PlayerShipController>() != null, "controller=" + (ship.GetComponent<PlayerShipController>() != null));
            Mark("E-F6 keeps RCS", ship.GetComponent<RcsThrusterController>() != null, "rcs=" + (ship.GetComponent<RcsThrusterController>() != null));
            Mark("E-F6 keeps Camera binding", Camera.main != null && Camera.main.GetComponent<SimpleFollowCamera>() != null, "camera=" + (Camera.main != null));
            Mark("E-F6 no stale external assist", !controller.HasExternalFlightAssistRequest, "source=" + ExternalSource());
            CaptureScreenshot("f6-switch-after-movement.png");
        }

        private void RunExternalAssistPriorityTest()
        {
            ResetFlight(true, FlightControlMode.Translation);
            controller.SetExternalFlightAssistRequest(new FlightAssistRequest(
                FlightAssistMode.AssistedFlight,
                FlightAssistRequestSource.WaypointAutopilot,
                ship.transform.right * 5000f,
                Vector3.up * 500f,
                0f,
                false));
            Mark("F-external source waypoint set", controller.LastExternalFlightAssistRequest.source == FlightAssistRequestSource.WaypointAutopilot, "source=" + ExternalSource());
            Sample("F-external-before-manual");
            RunInput("F-manual-clears-external", true, false, false, false, false, false, false, false, false, false, 10);
            Mark("F-manual input clears stale external assist", !controller.HasExternalFlightAssistRequest, "source=" + ExternalSource());
        }

        private void ResetFlight(bool sasEnabled, FlightControlMode mode)
        {
            controller.ResetFlightState(startPosition, Quaternion.identity, true);
            rigidbody.linearVelocity = Vector3.zero;
            rigidbody.angularVelocity = Vector3.zero;
            controller.SetMainThrottle(0f);
            controller.ClearExternalFlightAssistRequest();
            autopilot?.Abort("movement evidence reset");
            autopilot?.SetNavigationDebugPlanningActive(false);
            momentumAssist?.Abort("movement evidence reset");
            weaponStabilizer?.ClearPendingRequest("evidence reset");
            controller.SetRcsEnabled(true);
            controller.SetSasEnabled(sasEnabled);
            controller.SetControlMode(mode);
            followCamera.ResetFraming();
            followCamera.SnapNextFrame();
            Physics.SyncTransforms();
            cameraLateUpdate.Invoke(followCamera, null);
            Sample("reset-" + mode + "-sas-" + sasEnabled);
        }

        private void RunInput(
            string phase,
            bool w,
            bool s,
            bool a,
            bool d,
            bool q,
            bool e,
            bool h,
            bool n,
            bool shift,
            bool ctrl,
            int frames)
        {
            for (int i = 0; i < frames; i++)
            {
                controller.ApplyModeSpecificInputForTests(w, s, a, d, q, e, h, n, shift, ctrl);
                fixedUpdate.Invoke(controller, null);
                Physics.Simulate(fixedDeltaTime);
                cameraLateUpdate.Invoke(followCamera, null);
                simulatedTime += fixedDeltaTime;

                if (i == 0 || i == frames - 1 || i % 15 == 0)
                {
                    Sample(phase + " frame " + i);
                }
            }
        }

        private void RunRelease(string phase, int frames)
        {
            RunInput(phase, false, false, false, false, false, false, false, false, false, false, frames);
        }

        private void Sample(string phase)
        {
            string source = ExternalSource();
            csv.WriteLine(
                F(simulatedTime) + ","
                + switcher.SelectedVisualMode + ","
                + controller.ControlMode + ","
                + controller.EffectiveSasEnabled + ","
                + controller.RcsEnabled + ","
                + controller.HasExternalFlightAssistRequest + ","
                + source + ","
                + V(controller.RcsTranslationCommand) + ","
                + V(controller.RcsAttitudeCommand) + ","
                + V(rigidbody.linearVelocity) + ","
                + V(rigidbody.angularVelocity) + ","
                + V(controller.LastRcsDesiredForceWorld) + ","
                + V(controller.LastRcsActualForceWorld) + ","
                + V(controller.LastRcsResidualForceWorld) + ","
                + V(controller.LastRcsDesiredTorqueWorld) + ","
                + V(controller.LastRcsActualTorqueWorld) + ","
                + V(controller.LastRcsResidualTorqueWorld) + ","
                + controller.LastRcsAllocatorStatus + ","
                + controller.ActiveRcsNozzleCount + ","
                + controller.InstalledRcsNozzleCount + ","
                + followCamera.CameraFocusSource + ","
                + F(followCamera.AnchorError) + ","
                + followCamera.VisualBoundsRefreshCount + ","
                + rcs.NozzleRefreshCount);

            log.WriteLine(
                phase
                + " t=" + F(simulatedTime)
                + " visual=" + switcher.SelectedVisualMode
                + " mode=" + controller.ControlMode
                + " sas=" + controller.EffectiveSasEnabled
                + " rcs=" + controller.RcsEnabled
                + " ext=" + controller.HasExternalFlightAssistRequest + "/" + source
                + " trans=" + controller.RcsTranslationCommand
                + " att=" + controller.RcsAttitudeCommand
                + " vel=" + rigidbody.linearVelocity
                + " ang=" + rigidbody.angularVelocity
                + " desiredF=" + controller.LastRcsDesiredForceWorld
                + " actualF=" + controller.LastRcsActualForceWorld
                + " residualF=" + controller.LastRcsResidualForceWorld
                + " desiredT=" + controller.LastRcsDesiredTorqueWorld
                + " actualT=" + controller.LastRcsActualTorqueWorld
                + " residualT=" + controller.LastRcsResidualTorqueWorld
                + " status=" + controller.LastRcsAllocatorStatus
                + " nozzles=" + controller.ActiveRcsNozzleCount + "/" + controller.InstalledRcsNozzleCount
                + " camera=" + followCamera.CameraFocusSource
                + " anchorErr=" + F(followCamera.AnchorError));
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
                File.Copy(path, Path.Combine(mirrorScreenshotRoot, fileName), true);
                Mark("Screenshot " + fileName, File.Exists(path), path);
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

        private void Mark(string label, bool condition, string detail)
        {
            protocol.WriteLine("- " + (condition ? "PASS" : "FAIL") + ": " + label + " (" + detail + ")");
            log.WriteLine((condition ? "PASS" : "FAIL") + ": " + label + " (" + detail + ")");
            passed &= condition;
        }

        private void WriteProtocolVerdict()
        {
            protocol.WriteLine();
            protocol.WriteLine("## Summary");
            protocol.WriteLine("- Final visual mode: " + switcher.SelectedVisualMode);
            protocol.WriteLine("- Final allocator status: " + controller.LastRcsAllocatorStatus);
            protocol.WriteLine("- Allocator status note: com-translation-fallback is expected for imported visual translation; translation is applied at center of mass to avoid imported socket torque coupling, while torque requests remain allocator-driven.");
            protocol.WriteLine("- Final active/installed nozzles: " + controller.ActiveRcsNozzleCount + "/" + controller.InstalledRcsNozzleCount);
            protocol.WriteLine("- Nozzle count note: 4 active of 20 is expected for a one-axis RCS sample; installed count must remain stable at 20.");
            protocol.WriteLine("- Movement tolerances: translation velocityDot > 0.25, forceDot > 1000, residual force ratio < 0.1, pure-attitude residual torque < 25, pure-attitude linear force < 50.");
            protocol.WriteLine("- Final camera focus source: " + followCamera.CameraFocusSource);
            protocol.WriteLine("- Visual bounds refresh count: " + followCamera.VisualBoundsRefreshCount);
            protocol.WriteLine("- RCS nozzle refresh count: " + rcs.NozzleRefreshCount);
            protocol.WriteLine("- Final verdict: " + (passed ? "PASS" : "FAIL"));
        }

        private void WriteEvidenceArtifacts()
        {
            string logPath = Path.Combine(evidenceRoot, "logs", "unity-playmode-movement.log");
            string csvPath = Path.Combine(evidenceRoot, "performance", "movement-diagnostics.csv");
            string mirrorLogPath = Path.Combine(mirrorRoot, "logs", "unity-playmode-movement.log");
            string mirrorCsvPath = Path.Combine(mirrorRoot, "performance", "movement-diagnostics.csv");

            File.WriteAllText(logPath, log.ToString());
            File.WriteAllText(csvPath, csv.ToString());
            File.WriteAllText(mirrorLogPath, log.ToString());
            File.WriteAllText(mirrorCsvPath, csv.ToString());

            FileInfo logInfo = new FileInfo(logPath);
            FileInfo csvInfo = new FileInfo(csvPath);
            Mark("Log artifact written", logInfo.Exists && logInfo.Length > 0, logPath + " bytes=" + logInfo.Length);
            Mark("CSV artifact written", csvInfo.Exists && csvInfo.Length > 0, csvPath + " bytes=" + csvInfo.Length);
        }

        private void WriteProtocolArtifacts()
        {
            File.WriteAllText(Path.Combine(evidenceRoot, "test-protocol.md"), protocol.ToString());
            File.WriteAllText(Path.Combine(mirrorRoot, "test-protocol.md"), protocol.ToString());
        }

        private string ExternalSource()
        {
            return controller.HasExternalFlightAssistRequest
                ? controller.LastExternalFlightAssistRequest.source.ToString()
                : "None";
        }

        private static bool IsFinite(Vector3 value)
        {
            return float.IsFinite(value.x) && float.IsFinite(value.y) && float.IsFinite(value.z);
        }

        private static string F(float value)
        {
            return value.ToString("0.######", Invariant);
        }

        private static string V(Vector3 value)
        {
            return F(value.x) + "," + F(value.y) + "," + F(value.z);
        }
    }
}
#endif
