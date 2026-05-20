using UnityEngine;

public static class PrototypeUiFormatter
{
    public static string FormatVector(Vector3 value)
    {
        return $"({value.x:0.00}, {value.y:0.00}, {value.z:0.00})";
    }

    public static string FormatCompact(float value)
    {
        if (float.IsNaN(value))
        {
            return "n/a";
        }

        return float.IsInfinity(value) ? "inf" : value.ToString("0.00");
    }

    public static string FormatSpeed(float metersPerSecond)
    {
        return $"{FormatCompact(metersPerSecond)} m/s";
    }

    public static string FormatFuel(float kilograms)
    {
        return $"{FormatCompact(kilograms)} kg";
    }

    public static string FormatStatus(bool enabled, string enabledText = "ON", string disabledText = "OFF")
    {
        return enabled ? enabledText : disabledText;
    }

    public static string FormatAuthority(float authority)
    {
        if (float.IsNaN(authority) || float.IsInfinity(authority))
        {
            return "n/a";
        }

        return authority.ToString("0.00");
    }
}
