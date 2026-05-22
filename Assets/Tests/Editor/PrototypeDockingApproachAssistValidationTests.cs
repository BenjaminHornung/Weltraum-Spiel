#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UnityEngine;

public class PrototypeDockingApproachAssistValidationTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("DockingAssistSource");
        DestroyNamed("DockingAssistTarget");
        DestroyNamed("DockingAssistCandidate");
        DestroyNamed("PrototypeDockingApproachTarget");
    }

    [Test]
    public void AssistantBindsSourceAndSelectedTargetAndRoutesSoftCapture()
    {
        using (var fixture = new Fixture())
        {
            fixture.Assist.SetTargetDockingPort(fixture.TargetPort);

            InvokeFixedUpdate(fixture.Assist);

            Assert.NotNull(fixture.Assist.SourceDockingPort);
            Assert.That(fixture.Assist.TargetDockingPort, Is.SameAs(fixture.TargetPort));
            Assert.True(fixture.Assist.IsAssistanceRouted);
            Assert.True(fixture.Controller.HasExternalFlightAssistRequest);
            Assert.That(fixture.Controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.Docking));
            Assert.True(fixture.Assist.LastSnapshot.SoftCaptureRequested);
            Assert.True(fixture.Assist.LastSnapshot.EligibilityValid);
            Assert.That(fixture.Assist.LastSnapshot.AlignmentLabel, Is.EqualTo("Aligned"));
            Assert.That(fixture.Assist.LastSnapshot.ReadinessLabel, Is.EqualTo("Routed"));
            Assert.That(fixture.Assist.LastSnapshot.TargetName, Is.EqualTo(fixture.TargetPort.name));
            Assert.That(fixture.Assist.LastSnapshot.DistanceMeters, Is.EqualTo(0.2f).Within(0.001f));
            Assert.That(fixture.Assist.LastSnapshot.LateralOffsetMeters.magnitude, Is.LessThan(0.0001f));

            PrototypePlayerHudSnapshot hudSnapshot = PrototypePlayerHudSnapshotBuilder.Build(
                fixture.Source.transform,
                fixture.SourceBody,
                null,
                fixture.Controller,
                null,
                null,
                null,
                fixture.SourcePort,
                fixture.TargetPort,
                null,
                fixture.Assist);
            Assert.True(hudSnapshot.Docking.SoftCaptureAssistanceRouted);
            Assert.That(hudSnapshot.Docking.SoftCaptureAssistLabel, Is.EqualTo("Soft Capture Assist aktiv"));
        }
    }

    [Test]
    public void AssistantPrefersExplicitTargetCandidatesBeforeGlobalSearch()
    {
        using (var fixture = new Fixture())
        {
            DockingPort candidateTarget = fixture.CreateTarget("DockingAssistCandidate", new Vector3(0f, 0f, 0.4f));

            fixture.Assist.SetTargetDockingPort(null);
            fixture.Assist.SetTargetCandidates(new[] { candidateTarget });

            InvokeFixedUpdate(fixture.Assist);

            Assert.That(fixture.Assist.TargetDockingPort, Is.SameAs(candidateTarget));
            Assert.True(fixture.Assist.IsAssistanceRouted);
            Assert.True(fixture.Assist.LastSnapshot.EligibilityValid);
        }
    }

    [Test]
    public void AssistantClearsDockingRequestWhenIneligibleButKeepsOtherExternalRequestOnDisable()
    {
        using (var fixture = new Fixture())
        {
            fixture.Assist.SetTargetDockingPort(fixture.TargetPort);
            InvokeFixedUpdate(fixture.Assist);

            Assert.True(fixture.Controller.HasExternalFlightAssistRequest);
            Assert.That(fixture.Controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.Docking));

            fixture.SetTargetDistance(12f);
            InvokeFixedUpdate(fixture.Assist);

            Assert.False(fixture.Controller.HasExternalFlightAssistRequest);
            Assert.False(fixture.Assist.LastSnapshot.EligibilityValid);

            fixture.Controller.SetExternalFlightAssistRequest(new FlightAssistRequest(
                FlightAssistMode.AssistedFlight,
                FlightAssistRequestSource.WaypointAutopilot,
                Vector3.zero,
                Vector3.zero,
                false));

            fixture.Assist.SetAssistEnabled(false);
            InvokeFixedUpdate(fixture.Assist);

            Assert.True(fixture.Controller.HasExternalFlightAssistRequest);
            Assert.That(fixture.Controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.WaypointAutopilot));
        }
    }

    [Test]
    public void AssistantReportsHardLockPlaceholderWithoutCreatingDockedState()
    {
        using (var fixture = new Fixture())
        {
            fixture.Assist.SetTargetDockingPort(fixture.TargetPort);
            InvokeFixedUpdate(fixture.Assist);

            Assert.True(fixture.Assist.LastSnapshot.HardLockPlaceholder);
            Assert.False(fixture.Assist.LastSnapshot.HardLockJointCreated);
        }
    }

    [Test]
    public void AssistantComponentContainsNoDirectRigidbodyPositionOrVelocityWrites()
    {
        string sourcePath = Path.Combine("Assets", "Scripts", "Prototype", "PrototypeDockingApproachAssist.cs");
        string source = File.ReadAllText(sourcePath);

        Assert.False(Regex.IsMatch(source, @"\.\s*position\s*="), "PrototypeDockingApproachAssist must not assign position directly.");
        Assert.False(Regex.IsMatch(source, @"\.\s*velocity\s*="), "PrototypeDockingApproachAssist must not assign velocity directly.");
        Assert.False(Regex.IsMatch(source, @"\.\s*linearVelocity\s*="), "PrototypeDockingApproachAssist must not assign linearVelocity directly.");
        Assert.False(Regex.IsMatch(source, @"\.\s*angularVelocity\s*="), "PrototypeDockingApproachAssist must not assign angularVelocity directly.");
    }

    private static void InvokeFixedUpdate(PrototypeDockingApproachAssist assist)
    {
        MethodInfo fixedUpdate = typeof(PrototypeDockingApproachAssist).GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(assist, null);
    }

    private static void DestroyNamed(string name)
    {
        GameObject target = GameObject.Find(name);
        if (target != null)
        {
            UnityEngine.Object.DestroyImmediate(target);
        }
    }

    private sealed class Fixture : IDisposable
    {
        private readonly PrototypeScenarioBuilder builder;
        private readonly List<GameObject> owned = new List<GameObject>();
        public readonly GameObject Source;
        public readonly GameObject Target;
        public readonly PlayerShipController Controller;
        public readonly Rigidbody SourceBody;
        public readonly Rigidbody TargetBody;
        public readonly DockingPort SourcePort;
        public readonly DockingPort TargetPort;
        public readonly PrototypeDockingApproachAssist Assist;

        public Fixture()
        {
            builder = new PrototypeScenarioBuilder();
            var rig = builder.CreateShip("DockingAssistSource");
            Source = rig.Ship;
            Controller = rig.Controller;
            SourceBody = rig.Body;

            SourcePort = Source.AddComponent<DockingPort>();
            SourcePort.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);

            Target = CreateTargetObject("DockingAssistTarget", new Vector3(0f, 0f, 0.2f));
            TargetPort = AddDockingPort(Target);
            TargetBody = Target.GetComponent<Rigidbody>();

            Assist = Source.AddComponent<PrototypeDockingApproachAssist>();
            Assist.SetAssistEnabled(true);
        }

        public void SetTargetDistance(float distanceMeters)
        {
            if (Target != null)
            {
                Target.transform.position = Vector3.forward * distanceMeters;
            }
        }

        public DockingPort CreateTarget(string name, Vector3 position)
        {
            GameObject target = CreateTargetObject(name, position);
            return AddDockingPort(target);
        }

        public void Dispose()
        {
            builder.Dispose();
            for (int i = owned.Count - 1; i >= 0; i--)
            {
                DestroyGameObject(owned[i]);
            }

            owned.Clear();
        }

        private GameObject CreateTargetObject(string name, Vector3 position)
        {
            GameObject target = new GameObject(name);
            target.transform.position = position;
            target.transform.rotation = Quaternion.LookRotation(Vector3.back, Vector3.up);
            Rigidbody body = target.AddComponent<Rigidbody>();
            body.useGravity = false;
            body.linearDamping = 0f;
            body.angularDamping = 0f;

            owned.Add(target);
            return target;
        }

        private DockingPort AddDockingPort(GameObject targetObject)
        {
            DockingPort port = targetObject.AddComponent<DockingPort>();
            port.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
            return port;
        }

        private static void DestroyGameObject(GameObject target)
        {
            if (target == null)
            {
                return;
            }

            if (Application.isPlaying)
            {
                UnityEngine.Object.Destroy(target);
            }
            else
            {
                UnityEngine.Object.DestroyImmediate(target);
            }
        }
    }
}
#endif
