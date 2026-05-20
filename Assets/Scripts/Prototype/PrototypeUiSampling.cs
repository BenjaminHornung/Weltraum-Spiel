using UnityEngine;

public sealed class PrototypeUiSampleGate
{
    private bool hasSample;
    private float lastSampleTime = float.NegativeInfinity;

    public PrototypeUiSampleGate(float intervalSeconds)
    {
        IntervalSeconds = Mathf.Max(0f, intervalSeconds);
    }

    public float IntervalSeconds { get; }
    public int SampleCount { get; private set; }
    public float LastSampleTime => lastSampleTime;

    public bool ShouldSample(float nowSeconds, bool force = false)
    {
        if (!force && hasSample && nowSeconds - lastSampleTime < IntervalSeconds)
        {
            return false;
        }

        hasSample = true;
        lastSampleTime = nowSeconds;
        SampleCount++;
        return true;
    }

    public void Invalidate()
    {
        hasSample = false;
    }
}
