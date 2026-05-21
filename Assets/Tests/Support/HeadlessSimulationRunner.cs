#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

public sealed class HeadlessSimulationRunner : IDisposable
{
    private const BindingFlags TickMethodFlags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    private readonly float fixedDeltaTime;
    private readonly List<Action<float>> updateTicks = new List<Action<float>>();
    private readonly List<Action<float>> fixedTicks = new List<Action<float>>();
    private readonly SimulationMode previousSimulationMode;
    private readonly float previousFixedDeltaTime;
    private bool disposed;

    public HeadlessSimulationRunner(float fixedDeltaTime = 0.02f)
    {
        this.fixedDeltaTime = Mathf.Max(0.0001f, fixedDeltaTime);
        previousSimulationMode = Physics.simulationMode;
        previousFixedDeltaTime = Time.fixedDeltaTime;

        Physics.simulationMode = SimulationMode.Script;
        Time.fixedDeltaTime = this.fixedDeltaTime;
        Physics.SyncTransforms();
    }

    public float FixedDeltaTime => fixedDeltaTime;
    public int StepCount { get; private set; }
    public float ElapsedTime => StepCount * fixedDeltaTime;

    public void AddUpdateTick(Action<float> tick)
    {
        if (tick != null)
        {
            updateTicks.Add(tick);
        }
    }

    public void AddFixedTick(Action<float> tick)
    {
        if (tick != null)
        {
            fixedTicks.Add(tick);
        }
    }

    public void AddUpdateTick(object target)
    {
        AddUpdateTick(CreateReflectedTick(target, "Update"));
    }

    public void AddFixedTick(object target)
    {
        AddFixedTick(CreateReflectedTick(target, "FixedUpdate"));
    }

    public void Step(int count = 1)
    {
        if (disposed)
        {
            throw new ObjectDisposedException(nameof(HeadlessSimulationRunner));
        }

        if (count < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(count));
        }

        for (int i = 0; i < count; i++)
        {
            RunTicks(updateTicks);
            RunTicks(fixedTicks);
            Physics.Simulate(fixedDeltaTime);
            Physics.SyncTransforms();
            StepCount++;
        }
    }

    public void Dispose()
    {
        if (disposed)
        {
            return;
        }

        Physics.simulationMode = previousSimulationMode;
        Time.fixedDeltaTime = previousFixedDeltaTime;
        Physics.SyncTransforms();
        disposed = true;
    }

    private void RunTicks(List<Action<float>> ticks)
    {
        for (int i = 0; i < ticks.Count; i++)
        {
            ticks[i](fixedDeltaTime);
        }
    }

    private static Action<float> CreateReflectedTick(object target, string methodName)
    {
        if (target == null)
        {
            throw new ArgumentNullException(nameof(target));
        }

        MethodInfo method = target.GetType().GetMethod(methodName, TickMethodFlags);
        if (method == null)
        {
            throw new MissingMethodException(target.GetType().Name, methodName);
        }

        ParameterInfo[] parameters = method.GetParameters();
        if (parameters.Length == 0)
        {
            return _ => method.Invoke(target, null);
        }

        if (parameters.Length == 1 && parameters[0].ParameterType == typeof(float))
        {
            return deltaTime => method.Invoke(target, new object[] { deltaTime });
        }

        throw new InvalidOperationException($"{target.GetType().Name}.{methodName} must take no parameters or one float deltaTime parameter.");
    }
}
#endif
