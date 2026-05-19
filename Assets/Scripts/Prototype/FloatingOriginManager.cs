using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public class FloatingOriginManager : MonoBehaviour
{
    [SerializeField] private bool floatingOriginEnabled;
    [SerializeField] private float shiftThreshold = 5000f;
    [SerializeField] private FloatingOriginBody focusBody;
    [SerializeField] private LargeWorldVector3d origin;

    private readonly List<FloatingOriginBody> registeredBodies = new List<FloatingOriginBody>();

    public bool FloatingOriginEnabled => floatingOriginEnabled;
    public float ShiftThreshold => Mathf.Max(1f, shiftThreshold);
    public FloatingOriginBody FocusBody => focusBody;
    public LargeWorldVector3d Origin => origin;
    public Vector3 LastShiftLocal { get; private set; }
    public int ShiftCount { get; private set; }
    public int RegisteredBodyCount => registeredBodies.Count;

    private void FixedUpdate()
    {
        TryShiftOriginIfNeeded();
    }

    public void Configure(bool enabled, float threshold, FloatingOriginBody focus)
    {
        floatingOriginEnabled = enabled;
        shiftThreshold = Mathf.Max(1f, threshold);
        focusBody = focus;
    }

    public void Register(FloatingOriginBody body)
    {
        if (body == null || registeredBodies.Contains(body))
        {
            return;
        }

        registeredBodies.Add(body);
        body.SetManager(this);
        body.CaptureAbsoluteState(origin);
    }

    public void Unregister(FloatingOriginBody body)
    {
        registeredBodies.Remove(body);
    }

    public bool TryShiftOriginIfNeeded()
    {
        if (!floatingOriginEnabled || focusBody == null)
        {
            LastShiftLocal = Vector3.zero;
            return false;
        }

        Vector3 focusLocalPosition = focusBody.LocalUnityPosition;
        float threshold = ShiftThreshold;
        if (focusLocalPosition.sqrMagnitude < threshold * threshold)
        {
            LastShiftLocal = Vector3.zero;
            return false;
        }

        ShiftOriginBy(focusLocalPosition);
        return true;
    }

    public void ShiftOriginBy(Vector3 localShift)
    {
        if (localShift.sqrMagnitude <= 0.000001f)
        {
            LastShiftLocal = Vector3.zero;
            return;
        }

        for (int i = 0; i < registeredBodies.Count; i++)
        {
            if (registeredBodies[i] != null)
            {
                registeredBodies[i].CaptureAbsoluteState(origin);
            }
        }

        origin += localShift;

        for (int i = 0; i < registeredBodies.Count; i++)
        {
            if (registeredBodies[i] != null)
            {
                registeredBodies[i].ApplyLocalPosition(origin);
            }
        }

        LastShiftLocal = localShift;
        ShiftCount++;
    }
}
